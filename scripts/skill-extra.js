/* Bốn trò kỹ năng bổ sung: "Tìm lỗi sai" (spot) và "Phân loại nhanh"
   (classpos · classtense · classprep). Tách riêng để template.html nhẹ.
   - build()/audit(): hàm thuần, chạy được ở Node để test và kiểm độ phủ.
   - play(): dựng giao diện, nhận ctx do template.html truyền (el/esc/finish/wrong…).
   0 lời gọi AI, 0 CSDL, 0 thư viện ngoài. Luật chỉ được nói khi KHỚP với đáp án
   đã lưu trong ngân hàng — thà bỏ câu còn hơn dạy sai. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SkillExtra = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ========== 0. Bảng quy tắc và ngoại lệ ========== */
  var POS_BINS = [
    { id: "n", label: "Danh từ" },
    { id: "v", label: "Động từ" },
    { id: "adj", label: "Tính từ" },
    { id: "adv", label: "Trạng từ" },
  ];
  var POS_BIN = { noun: "n", person: "n", verb: "v", adjective: "adj", adverb: "adv" };
  var BIN_LABEL = { n: "Danh từ", v: "Động từ", adj: "Tính từ", adv: "Trạng từ" };

  /* Vừa là danh từ vừa là động từ: luật đuôi không phân biệt được nên không
     được làm thẻ "Từ này là…". */
  var AMBIGUOUS = {};
  (
    "report increase plan work order price book answer offer review access link " +
    "list log mail note open close cover case item level line match mean need " +
    "part point record result round service shift suit time trade view wave wear " +
    "want cost cut set pick check call help love start stop look leave ask show " +
    "place state change answer support watch train share staff"
  )
    .split(" ")
    .forEach(function (w) {
      AMBIGUOUS[w] = 1;
    });

  /* Đuôi -ly nhưng là tính từ (và các từ dễ nhầm khác): theo đặc tả, loại khỏi
     thẻ "Từ này là…" vì người học đoán lớp từ theo đuôi sẽ sai. */
  var LY_ADJ = {};
  (
    "friendly early daily likely lovely costly weekly monthly yearly only ugly " +
    "silly lonely lively holy elderly brotherly orderly costly"
  )
    .split(" ")
    .forEach(function (w) {
      LY_ADJ[w] = 1;
    });

  var TENSE_LABEL = {
    present: "Hiện tại đơn",
    ing: "Hiện tại tiếp diễn",
    pp: "Hiện tại hoàn thành",
    "past-perfect": "Quá khứ hoàn thành",
    "perfect-future": "Tương lai hoàn thành",
    "past-ing": "Quá khứ tiếp diễn",
    "future-ing": "Tương lai tiếp diễn",
    past: "Quá khứ đơn",
    future: "Tương lai đơn",
  };
  var TENSE_NEAR_RE = /\bgoing to\b/i;

  var PREP_BINS = [
    { id: "in", label: "in" },
    { id: "on", label: "on" },
    { id: "at", label: "at" },
  ];
  var DAYS = "monday tuesday wednesday thursday friday saturday sunday";
  var MONTHS =
    "january february march april may june july august september october november december";
  function alt(list) {
    return String(list).trim().split(/\s+/).join("|");
  }
  var DAY_RE = "^(" + alt(DAYS) + ")\\b";
  var MONTH_RE = "^(" + alt(MONTHS) + ")\\b";
  function tail(str, n) {
    return String(str || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, n || 3)
      .join(" ");
  }
  /* Quy tắc giới từ: chỉ những cụm KHÔNG tranh cãi. after = 1–3 từ ngay sau chỗ
     trống, before = từ cuối trước chỗ trống. Không quy tắc nào khớp thì bỏ câu. */
  var PREP_RULES = [
    {
      prep: "on",
      why: "thứ trong tuần hoặc ngày cụ thể đi với ON",
      test: function (after) {
        return (
          new RegExp(DAY_RE).test(after) ||
          new RegExp("^\\d{1,2}(st|nd|rd|th)\\b").test(after) ||
          new RegExp("^the \\d{1,2}(st|nd|rd|th)\\b").test(after) ||
          new RegExp("^\\d{1,2}\\s+" + MONTH_RE.slice(1)).test(after) ||
          new RegExp(MONTH_RE.slice(1) + "\\s+\\d").test(after)
        );
      },
    },
    {
      prep: "on",
      why: "buổi trong một ngày cụ thể đi với ON",
      test: function (after, before) {
        return new RegExp(DAY_RE).test(before) && /^(morning|afternoon|evening)\b/.test(after);
      },
    },
    {
      prep: "on",
      why: "ngày cụ thể (their first day, the last day) đi với ON",
      test: function (after) {
        return /^(my|your|his|her|its|our|their|the) (first|last|second|third|final) (day|night|week|month|year)\b/.test(after);
      },
    },
    {
      prep: "on",
      why: "cuối tuần đi với ON (on weekends, on the weekend)",
      test: function (after) {
        return /^(weekends?|the weekend)\b/.test(after);
      },
    },
    {
      prep: "in",
      why: "buổi trong ngày (the morning/afternoon/evening) đi với IN",
      test: function (after) {
        return /^the (morning|afternoon|evening)\b/.test(after);
      },
    },
    {
      prep: "in",
      why: "cụm cố định in accordance with / in search of đi với IN",
      test: function (after) {
        return /^(accordance with|search of|response to|addition to|charge of|favor of)\b/.test(after);
      },
    },
    {
      prep: "in",
      why: "tháng, năm, mùa hoặc thế kỷ đi với IN",
      test: function (after) {
        return (
          new RegExp(MONTH_RE).test(after) ||
          /^(spring|summer|autumn|fall|winter)\b/.test(after) ||
          /^(19|20)\d\d\b/.test(after) ||
          /^the \d{2}(th|st|nd|rd) century\b/.test(after)
        );
      },
    },
    {
      prep: "in",
      why: "khoảng thời gian tương lai (in two days) đi với IN",
      test: function (after) {
        return (
          /^(\d+|a|an|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty)\s+(minutes?|hours?|days?|weeks?|months?|years?)\b/.test(
            after,
          ) || /^a (couple|few)\s+(days?|weeks?|months?|years?)\b/.test(after)
        );
      },
    },
    {
      prep: "at",
      why: "giờ trên đồng hồ đi với AT",
      test: function (after, before, tight) {
        return /^\d{1,4}(am|pm|oclock)/.test(tight) || /^\d{1,2}:\d{2}/.test(after);
      },
    },
    {
      prep: "at",
      why: "buổi tối và các mốc cố định (night, noon, midnight) đi với AT",
      test: function (after) {
        return (
          /^(the )?night\b/.test(after) ||
          /^(noon|midnight)\b/.test(after) ||
          /^the (moment|same time|end|beginning|start|age)\b/.test(after)
        );
      },
    },
    {
      prep: "at",
      why: "một điểm cụ thể đi với AT",
      test: function (after) {
        return new RegExp(
          "^the (airport|station|bus stop|crossroads|intersection|entrance|reception|door|" +
            "meeting|conference|party|concert|cinema|theater|theatre|exhibition|" +
            "checkout|exit|turning)",
        ).test(after);
      },
    },
    {
      prep: "on",
      why: "bề mặt, tầng hoặc phương tiện truyền thông đi với ON",
      test: function (after) {
        return new RegExp(
          "^the (table|desk|wall|floor|ground|ceiling|blackboard|board|menu|list|" +
            "website|site|internet|page|screen|map|photo|picture|left|right)|" +
            "^the (first|second|third|fourth|fifth|sixth|top|\\d{1,2})(st|nd|rd|th)? floor",
        ).test(after);
      },
    },
    {
      prep: "in",
      why: "không gian rộng hoặc ấn phẩm đi với IN",
      test: function (after) {
        return new RegExp(
          "^the (city|building|country|world|street|road|park|industrial park|village|region|" +
            "area|kitchen|bedroom|bathroom|garden|library|room|newspaper|" +
            "magazine|diary|queue)|" +
            "^the (cabinet|drawer|box|shelf|closet|fridge|freezer)|" +
            "^(in)?\\s*(vietnam|japan|korea|china|france|germany|thailand|" +
            "singapore|australia|india|canada|england|london|hanoi|ho chi minh|" +
            "paris|tokyo|beijing|seoul|bangkok|sydney|berlin|madrid|rome|moscow|" +
            "dubai|toronto|chicago|boston|seattle|new york)",
        ).test(after);
      },
    },
  ];

  /* Cụm cố định động từ/tính từ + giới từ (near = 3 từ cuối trước chỗ trống).
     Chỉ sinh thẻ khi giới từ suy ra TRÙNG đáp án đã lưu, nên không dạy sai. */
  PREP_RULES.push(
    {
      prep: "in",
      why: "cụm động từ/tính từ cố định (expert in, inherent in, belong in, …) đi với IN",
      test: function (after, before, tight, near) {
        return /\b(inherent|expert|speciali[sz]e[sd]?|succeed(s|ed)?|interest(s|ed)?|involve[sd]?|participat(e|es|ed|ing)|belong(s|ed)?|result(s|ed)?)\s*$/.test(near || "");
      },
    },
    {
      prep: "on",
      why: "cụm động từ cố định (rely on, insist on, focus on, …) đi với ON",
      test: function (after, before, tight, near) {
        return /\b(rel(y|ies|ied)|insist(s|ed)?|depend(s|ed)?|focus(es|ed)?|based|comment(s|ed)?)\s*$/.test(near || "");
      },
    },
    {
      prep: "on",
      why: "danh từ về chủ đề/ảnh hưởng (questions on, impact on, …) đi với ON",
      test: function (after, before, tight, near) {
        return /\b(questions?|information|advice|impacts?|effects?|influences?)\s*$/.test(near || "");
      },
    },
    {
      prep: "on",
      why: "cụm động từ pass on / cut down on / work on / spend on đi với ON",
      test: function (after, before, tight, near) {
        return /\b(pass(es|ed|ing)?|down|work(s|ed|ing)?|spend(s|t|ing)?)\s*$/.test(near || "");
      },
    },
    {
      prep: "at",
      why: "cụm động từ/tính từ cố định (good at, look at, aim at, …) đi với AT",
      test: function (after, before, tight, near) {
        return /\b(good|skilled|look(s|ed|ing)?|aim(s|ed|ing)?|arriv(e|es|ed|ing)|glanc(e|es|ed|ing)|star(e|es|ed|ing))\s*$/.test(near || "");
      },
    },
  );

  var MAX_CARDS = 12;
  var MIN_CARDS = 6;
  var SPOT_MAX_WORDS = 28;
  var SPOT_MIN_WORDS = 4;

  /* ========== 1. Tiện ích thuần ========== */
  function trim(t) {
    return String(t == null ? "" : t).replace(/\s+/g, " ").trim();
  }
  function blankParts(stem) {
    var s = String(stem || "");
    var hits = s.match(/_{2,}/g);
    if (!hits) return { parts: null, blanks: 0 };
    var m = /_{2,}/.exec(s);
    return {
      parts: { pre: s.slice(0, m.index), post: s.slice(m.index + m[0].length) },
      blanks: hits.length,
    };
  }
  function hasChoices(q) {
    return !!(q && Array.isArray(q.o) && q.o.length >= 2 && q.a != null && q.a >= 0 &&
      q.a < q.o.length && q.o.every(function (x) { return typeof x === "string"; }));
  }
  function explainOf(q) {
    return {
      explanation: q.explanation || null,
      explanationStatus: q.explanationStatus || "none",
      ucid: q.id,
      uco: Array.isArray(q.o) ? q.o : null,
      ua: q.a == null ? null : q.a,
      coach: q.coach || null,
      translation: q.translation || null,
    };
  }
  function mulberry(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rngOf(deps) {
    var r = deps && deps.rng;
    return typeof r === "function" ? r : Math.random;
  }
  function shuffle(list, rng) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }
  function capWord(w, up) {
    if (!w) return w;
    return up ? w.charAt(0).toUpperCase() + w.slice(1) : w.charAt(0).toLowerCase() + w.slice(1);
  }
  function startsSentence(pre) {
    var s = trim(pre);
    return !s || /[.!?]["'”’)]?$/.test(s);
  }
  function bump(stats, reason) {
    if (stats) stats[reason] = (stats[reason] || 0) + 1;
  }
  function wordList(s) {
    return trim(s).split(" ").filter(Boolean);
  }
  function isPunct(tok) {
    return !/[a-z0-9]/i.test(tok);
  }
  function isOpenPunct(tok) {
    return /^[("“‘'\[]+$/.test(tok);
  }
  /* Dựng câu đầy đủ từ pre + phần điền + post, trả token và đoạn [from,to). */
  function assemble(pre, filled, post) {
    var raw = [];
    wordList(pre).forEach(function (w) {
      raw.push({ t: w, in: false });
    });
    wordList(filled).forEach(function (w) {
      raw.push({ t: w, in: true });
    });
    wordList(post).forEach(function (w) {
      raw.push({ t: w, in: false });
    });
    /* Dấu câu đứng một mình (".", ",") dính vào từ liền trước/sau để không thành
       một "từ" riêng mà người chơi có thể bấm nhầm. */
    var merged = [];
    raw.forEach(function (x) {
      if (!merged.length) {
        merged.push(x);
        return;
      }
      var prev = merged[merged.length - 1];
      if (isPunct(x.t) && /[a-z0-9]/i.test(prev.t)) {
        prev.t += x.t;
        if (x.in) prev.in = true;
        return;
      }
      if (isOpenPunct(x.t)) {
        merged.push({ t: x.t, in: x.in, glue: true });
        return;
      }
      if (prev.glue) {
        prev.t += x.t;
        prev.glue = false;
        if (x.in) prev.in = true;
        return;
      }
      merged.push({ t: x.t, in: x.in });
    });
    merged.forEach(function (x) {
      delete x.glue;
    });
    var from = -1,
      to = -1;
    merged.forEach(function (x, i) {
      if (!x.in) return;
      if (from < 0) from = i;
      to = i + 1;
    });
    return {
      tokens: merged.map(function (x) { return x.t; }),
      span: from < 0 ? [0, 0] : [from, to],
    };
  }

  /* ========== 2. Tìm lỗi sai: sinh câu ========== */
  function sameFamily(a, b) {
    var x = String(a || "").toLowerCase(),
      y = String(b || "").toLowerCase();
    var n = 0;
    while (n < x.length && n < y.length && x[n] === y[n]) n++;
    return n >= 4;
  }

  function buildSpotItems(pool, deps, stats) {
    var rng = rngOf(deps);
    var out = [];
    (pool || []).forEach(function (q) {
      if (!q || q.status === "review") return void bump(stats, "review");
      if (!hasChoices(q)) return void bump(stats, "khong-a-d");
      var b = blankParts(q.q);
      if (!b.parts) return void bump(stats, "khong-cho-trong");
      if (b.blanks > 1) return void bump(stats, "nhieu-cho-trong");
      var opts = q.o.map(trim);
      var answer = opts[q.a];
      if (!answer || answer.length > 28) return void bump(stats, "dap-an-dai");
      for (var i = 0; i < opts.length; i++) {
        if (!opts[i] || opts[i].length > 44) return void bump(stats, "dap-an-dai");
      }
      var cands = [];
      opts.forEach(function (t, k) {
        if (k === q.a) return;
        if (!t) return;
        if (t.toLowerCase() === answer.toLowerCase()) return;
        cands.push(t);
      });
      if (!cands.length) return void bump(stats, "khong-co-nhieu");
      var family = cands.filter(function (t) {
        return sameFamily(t, answer);
      });
      var bag = family.length ? family : cands;
      var wrong = bag[Math.floor(rng() * bag.length) % bag.length];
      var up = startsSentence(b.parts.pre) || /^[A-Z]/.test(answer);
      wrong = capWord(wrong, up);
      var made = assemble(b.parts.pre, wrong, b.parts.post);
      var fixed = assemble(b.parts.pre, capWord(answer, up), b.parts.post);
      var n = made.tokens.length;
      if (n < SPOT_MIN_WORDS) return void bump(stats, "cau-qua-ngan");
      if (n > SPOT_MAX_WORDS) return void bump(stats, "cau-qua-dai");
      if (!made.span[1]) return void bump(stats, "khong-xac-dinh-span");
      var line = "";
      var ex = deps && deps.explainer;
      if (ex && typeof ex.analyze === "function") {
        try {
          var r = ex.analyze(
            { q: q.q, o: q.o, a: q.a, g: (q.payload && q.payload.g) || q.g },
            null,
          );
          var letter = "ABCDEF"[q.a] || "";
          (r.options || []).forEach(function (s) {
            if (s.indexOf(letter + ". " + wrong) === 0) line = s;
          });
        } catch (e) {}
      }
      out.push(
        Object.assign(
          {
            key: q.id,
            spot: true,
            tokens: made.tokens,
            span: made.span,
            fixedTokens: fixed.tokens,
            fixedSpan: fixed.span,
            wrong: wrong,
            answer: capWord(answer, up),
            o: shuffle(
              opts.map(function (t, k) {
                return { t: t, ok: k === q.a };
              }),
              rng,
            ),
            full: fixed.tokens.join(" "),
            wrongLine: line,
            t: q.t,
            n: q.n || "",
          },
          explainOf(q),
        ),
      );
    });
    return out;
  }

  /* ========== 3. Phân loại nhanh: sinh thẻ ========== */
  function factsOf(deps, q) {
    var ex = deps && deps.explainer;
    if (!ex || typeof ex.facts !== "function") return null;
    try {
      return ex.facts({ q: q.q, o: q.o, a: q.a, g: q.g });
    } catch (e) {
      return null;
    }
  }
  function snippet(parts, maxBefore, maxAfter) {
    var pre = wordList(parts.pre),
      post = wordList(parts.post);
    return {
      before: pre.slice(-maxBefore).join(" "),
      after: post.slice(0, maxAfter).join(" "),
    };
  }
  function cardKey(card) {
    return JSON.stringify(card);
  }

  function buildPosCards(pool, deps, stats) {
    var cards = [];
    (pool || []).forEach(function (q) {
      if (!q || q.status === "review" || !hasChoices(q)) return void bump(stats, "review");
      var f = factsOf(deps, q);
      if (!f || !f.blank) return void bump(stats, "khong-cho-trong");
      var ansWord = (wordList(trim(q.o[q.a]))[0] || "").toLowerCase();

      /* Loại 1: "Chỗ trống cần loại từ nào?" — chỉ sinh khi luật vị trí và lớp
         từ của đáp án đã lưu cùng chỉ một ô. */
      var need = f.blankNeeds;
      if (!need || !POS_BIN[need.need]) bump(stats, "khong-co-luat");
      else {
        /* Hai ngoại lệ lấy nguyên từ analyze(): "person" tính là danh từ, và ở
           câu bị động "was ___ by" thì V-ed mang đuôi tính từ vẫn là động từ. */
        var ansBin = POS_BIN[f.answerClass] ||
          (need.passive && f.answerClass === "adjective" && /ed$/.test(ansWord) ? "v" : "");
        if (!ansBin) bump(stats, "khong-khop-dap-an");
        else if (ansBin !== POS_BIN[need.need]) bump(stats, "khong-khop-dap-an");
        else {
          var snip = snippet(f.blank, 6, 6);
          if (!snip.before && !snip.after) bump(stats, "qua-ngan");
          else
            cards.push({
              classify: "pos",
              card: { before: snip.before, after: snip.after, word: null },
              label: "Chỗ trống cần loại từ nào?",
              bins: POS_BINS,
              answerBin: POS_BIN[need.need],
              why: trim(need.why).slice(0, 120),
              t: q.t,
            });
        }
      }

      /* Loại 2: "Từ này là loại gì?" — chỉ trong họ từ loại, và né bảng ngoại lệ. */
      if (!f.familyRoot) return;
      q.o.forEach(function (opt, k) {
        var w = wordList(trim(opt))[0] || "";
        var low = w.toLowerCase();
        if (!/^[A-Za-z][A-Za-z'-]{2,15}$/.test(w)) return void bump(stats, "mo-ho");
        if (AMBIGUOUS[low] || LY_ADJ[low]) return void bump(stats, "bang-ngoai-le");
        var cls = f.optionClasses[k];
        if (!cls || !POS_BIN[cls]) return void bump(stats, "mo-ho");
        cards.push({
          classify: "pos",
          card: { before: "", after: "", word: w },
          label: "Từ này là loại gì?",
          bins: POS_BINS,
          answerBin: POS_BIN[cls],
          why: "“" + w + "” được nhận ra là " + BIN_LABEL[POS_BIN[cls]].toLowerCase() +
            " qua dạng của từ.",
          t: q.t,
        });
      });
    });
    return cards;
  }

  function buildTenseCards(pool, deps, stats) {
    var cards = [];
    (pool || []).forEach(function (q) {
      if (!q || q.status === "review" || !hasChoices(q)) return void bump(stats, "review");
      var f = factsOf(deps, q);
      if (!f || !f.blank) return void bump(stats, "khong-cho-trong");
      var famCount = typeof f.verbFamilyCount === "number"
        ? f.verbFamilyCount
        : (f.verbFamily ? q.o.length : 0);
      if (famCount < 3) return void bump(stats, "khong-phai-ho-dong-tu");
      if (f.optionFamily && f.optionFamily[q.a] === false) return void bump(stats, "khong-phai-ho-dong-tu");
      if (!f.tenseCode) return void bump(stats, "khong-co-luat");
      var want = f.tenseCode;
      if (!TENSE_LABEL[want]) return void bump(stats, "luat-khong-co-nhan");
      /* "yesterday" vừa là quá khứ đơn vừa là hiện tại hoàn thành với V-ed,
         nên chỉ chắc chắn khi dạng của ĐÁP ÁN ĐÚNG khớp dấu hiệu. */
      if (f.answerForm !== want && !(want === "pp" && f.answerForm === "past" && /^(has|have|had)\b/i.test(trim(q.o[q.a]))))
        return void bump(stats, "khong-khop-dap-an");
      var bins = [],
        seen = {};
      q.o.forEach(function (opt, k) {
        if (f.optionFamily && !f.optionFamily[k]) return;
        var code = f.optionForms[k];
        var label = TENSE_NEAR_RE.test(opt) ? "Tương lai gần" : TENSE_LABEL[code];
        if (!label || seen[label]) return;
        seen[label] = 1;
        bins.push({ id: label, label: label });
      });
      var answerBin = TENSE_LABEL[want];
      if (!seen[answerBin]) return void bump(stats, "thieu-o-dung");
      if (bins.length < 3) return void bump(stats, "qua-it-bin");
      var snip = snippet(f.blank, 6, 7);
      var signal = String(f.tenseSignal || "").toLowerCase();
      var around = tail(snip.after, 6) + " " + tail(snip.before, 6);
      if (signal && around.indexOf(signal) < 0) {
        /* Dấu hiệu nằm xa chỗ trống (vd. “By the time …”, “would have …” cuối
           câu): chèn chính cụm dấu hiệu vào thẻ để người học vẫn thấy căn cứ. */
        if (tail(f.blank.pre, 40).indexOf(signal) >= 0)
          snip.before = "… " + signal + " … " + snippet(f.blank, 4, 0).before;
        else if (tail(f.blank.post, 40).indexOf(signal) >= 0)
          snip.after = snippet(f.blank, 0, 4).after + " … " + signal + " …";
        else return void bump(stats, "hieu-ngoai-cua-so");
      }
      cards.push({
        classify: "tense",
        card: { before: snip.before, after: snip.after, word: null, focus: f.tenseSignal },
        label: "Câu này ở thì nào?",
        bins: bins,
        answerBin: answerBin,
        why: "Dấu hiệu “" + f.tenseSignal + "” → " + TENSE_LABEL[want].toLowerCase() + ".",
        t: q.t,
      });
    });
    return cards;
  }

  function buildPrepCards(pool, deps, stats) {
    var cards = [];
    (pool || []).forEach(function (q) {
      if (!q || q.status === "review" || !hasChoices(q)) return void bump(stats, "review");
      var answer = trim(q.o[q.a]).toLowerCase();
      if (answer !== "in" && answer !== "on" && answer !== "at")
        return void bump(stats, "dap-an-khong-phai-in-on-at");
      var b = blankParts(q.q);
      if (!b.parts || b.blanks !== 1) return void bump(stats, "khong-cho-trong");
      var after = tail(b.parts.post, 3);
      var before = tail(String(b.parts.pre).split(/\s+/).slice(-1).join(" "), 1);
      var near = tail(String(b.parts.pre).split(/\s+/).slice(-3).join(" "), 3);
      if (!after) return void bump(stats, "khong-co-luat");
      var hit = null;
      var tight = after.replace(/\s+/g, "");
      PREP_RULES.forEach(function (r) {
        if (!hit && r.test(after, before, tight, near)) hit = r;
      });
      if (!hit) return void bump(stats, "khong-co-luat");
      if (hit.prep !== answer) return void bump(stats, "khong-khop-dap-an");
      var snip = snippet({ pre: b.parts.pre, post: b.parts.post }, 3, 3);
      cards.push({
        classify: "prep",
        card: { before: snip.before, after: snip.after, word: null },
        label: "Giới từ nào đứng trước cụm này?",
        bins: PREP_BINS,
        answerBin: answer,
        why: "“" + after + "” → " + hit.why + ".",
        t: q.t,
      });
    });
    return cards;
  }

  function rawCards(kind, pool, deps, stats) {
    return kind === "pos"
      ? buildPosCards(pool, deps, stats)
      : kind === "tense"
        ? buildTenseCards(pool, deps, stats)
        : buildPrepCards(pool, deps, stats);
  }

  function buildClassItems(kind, pool, deps, stats) {
    var cards = rawCards(kind, pool, deps, stats);
    var seen = {},
      uniq = [];
    cards.forEach(function (c) {
      var k = cardKey(c.card) + "|" + c.answerBin;
      if (seen[k]) return void bump(stats, "trung-the");
      seen[k] = 1;
      uniq.push(c);
    });
    if (uniq.length < MIN_CARDS) {
      bump(stats, "duoi-nguong-" + MIN_CARDS);
      return [];
    }
    var seconds = kind === "prep" ? 6 : 8;
    return shuffle(uniq, rngOf(deps)).slice(0, MAX_CARDS).map(function (c) {
      return Object.assign({ key: undefined, seconds: seconds }, c);
    });
  }

  var BUILDERS = {
    spot: function (pool, deps, stats) {
      return buildSpotItems(pool, deps, stats);
    },
    classpos: function (pool, deps, stats) {
      return buildClassItems("pos", pool, deps, stats);
    },
    classtense: function (pool, deps, stats) {
      return buildClassItems("tense", pool, deps, stats);
    },
    classprep: function (pool, deps, stats) {
      return buildClassItems("prep", pool, deps, stats);
    },
  };

  var META = {
    spot: {
      skill: "writing",
      name: "Tìm lỗi sai",
      desc: "Câu bị điền sai một chỗ — chạm từ sai, rồi chọn cách sửa.",
      color: "var(--sk-write)",
      soft: "var(--sk-write-soft)",
    },
    classpos: {
      skill: "reading",
      name: "Phân loại nhanh: Từ loại",
      desc: "Thẻ từ → ném vào ô Danh từ · Động từ · Tính từ · Trạng từ, 8 giây.",
      color: "var(--sk-read)",
      soft: "var(--sk-read-soft)",
      unit: "thẻ",
    },
    classtense: {
      skill: "reading",
      name: "Phân loại nhanh: Thì",
      desc: "Dấu hiệu thời gian trên thẻ → chọn đúng thì, 8 giây mỗi thẻ.",
      color: "var(--sk-read)",
      soft: "var(--sk-read-soft)",
      unit: "thẻ",
    },
    classprep: {
      skill: "reading",
      name: "Phân loại nhanh: in · on · at",
      desc: "Cụm sau chỗ trống → chọn giới từ, 6 giây mỗi thẻ.",
      color: "var(--sk-read)",
      soft: "var(--sk-read-soft)",
      unit: "thẻ",
    },
  };

  function build(id, pool, deps) {
    var fn = BUILDERS[id];
    return fn ? fn(pool, deps, null) : [];
  }
  function audit(id, pool, deps) {
    var fn = BUILDERS[id];
    if (!fn) return { items: [], skip: {} };
    var stats = {};
    var items = fn(pool, deps, stats);
    return { items: items, skip: stats };
  }

  /* ========== 4. Màn chơi: Tìm lỗi sai ========== */
  function playSpot(it, stage, ctx) {
    var esc = ctx.esc,
      s = ctx.s;
    var myI = s.i;
    var mistakes = 0,
      found = false;
    function live() {
      return ctx.alive(myI) && !s.answered;
    }
    var words = it.tokens
      .map(function (t, i) {
        return '<button class="skword" data-k="' + i + '">' + esc(t) + "</button>";
      })
      .join(" ");
    stage.innerHTML =
      '<p class="skstep" id="skSpotStep">Bước 1 · Câu này có đúng <b>1 chỗ sai</b>. Chạm vào từ sai.</p>' +
      '<div class="skstem" id="skSpotWords">' +
      words +
      "</div>" +
      '<div id="skSpotFix"></div>' +
      '<p class="muted" style="margin:8px 0 0">Dùng Tab để đi qua từng từ, Enter để chọn.</p>';

    function showFixes() {
      el2("skSpotStep").innerHTML = "Bước 2 · Chọn cách sửa đúng cho chỗ đã tô đỏ.";
      el2("skSpotFix").innerHTML =
        '<div class="skfixrow">' +
        it.o
          .map(function (o, i) {
            return '<button class="skchunk" data-f="' + i + '">' + esc(o.t) + "</button>";
          })
          .join(" ") +
        "</div>";
      el2("skSpotFix")
        .querySelectorAll("[data-f]")
        .forEach(function (b) {
          b.onclick = function () {
            if (!live()) return;
            var pick = it.o[Number(b.dataset.f)];
            if (pick.ok) {
              finishSpot(true);
              return;
            }
            mistakes++;
            b.disabled = true;
            ctx.wrong(b, "<div class='note'>Cái đó chưa đúng với câu này.</div>", it);
          };
        });
    }
    function el2(id) {
      return stage.querySelector("#" + id);
    }
    function finishSpot(pickedRight) {
      if (!live()) return;
      var ok = pickedRight && mistakes === 0;
      var shown = it.fixedTokens
        .map(function (t, i) {
          var inSpan = i >= it.fixedSpan[0] && i < it.fixedSpan[1];
          return inSpan
            ? '<span class="skword fixed">' + esc(t) + "</span>"
            : esc(t);
        })
        .join(" ");
      var html =
        "<div class='note'>✅ Sửa: <s>" +
        esc(it.wrong) +
        "</s> → <b>" +
        esc(it.answer) +
        "</b></div>" +
        '<div class="skstem" style="margin:8px 0">' +
        shown +
        "</div>" +
        (it.wrongLine ? "<div class='note'>" + esc(it.wrongLine) + "</div>" : "") +
        (it.n ? "<div class='note'>📝 " + esc(it.n) + "</div>" : "") +
        ctx.explain(it, ok ? "right" : "wrong");
      /* Không sai lần nào: +5 lúc tìm ra lỗi và +5 lúc sửa xong = 10 EXP. */
      ctx.finish(ok, html, ok ? 5 : 0, it, mistakes > 0);
    }
    el2("skSpotWords")
      .querySelectorAll("[data-k]")
      .forEach(function (b) {
        b.onclick = function () {
          if (!live() || found) return;
          var k = Number(b.dataset.k);
          if (k >= it.span[0] && k < it.span[1]) {
            found = true;
            if (mistakes === 0) ctx.bump(5);
            stage.querySelectorAll(".skword").forEach(function (n) {
              var i = Number(n.dataset.k);
              if (i >= it.span[0] && i < it.span[1]) n.classList.add("err");
              n.disabled = true;
            });
            showFixes();
            return;
          }
          mistakes++;
          b.disabled = true;
          b.classList.add("miss");
          b.innerHTML = esc(it.tokens[k]) + " ✗";
          ctx.wrong(b, "<div class='note'>Từ đó vẫn đúng. Cả câu chỉ có <b>1</b> chỗ sai.</div>", it);
        };
      });
  }

  /* ========== 5. Màn chơi: Phân loại nhanh (3 trò dùng chung) ========== */
  function playClassify(it, stage, ctx) {
    var esc = ctx.esc,
      s = ctx.s;
    var myI = s.i;
    var left = it.seconds,
      done = false;
    function live() {
      return ctx.alive(myI) && !s.answered;
    }
    var reduce = false;
    try {
      reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (e) {}

    var card = it.card;
    var focus = card.focus ? String(card.focus) : "";
    function mark(text) {
      var out = esc(text);
      if (!focus) return out;
      var re = new RegExp("(" + focus.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "i");
      return out.replace(re, "<b class='skfocus'>$1</b>");
    }
    var cardHtml = card.word
      ? '<span class="skqword">' + esc(card.word) + "</span>"
      : mark(card.before) +
        '<span class="skqblank">_____</span>' +
        mark(card.after);

    stage.innerHTML =
      '<p class="skstep">' + esc(it.label) + " · <span class='muted'>chạm ô, kéo thẻ vào ô, hoặc gõ phím 1–" + it.bins.length + "</span></p>" +
      '<div class="skqwrap"><div class="skqcard" id="skQCard" tabindex="0">' +
      cardHtml +
      "</div></div>" +
      '<div class="sktimer" id="skQTimer"><i style="width:100%"></i></div>' +
      '<div class="skbinrow' + (it.bins.length <= 3 ? " few" : "") + '" id="skQBins">' +
      it.bins
        .map(function (b, i) {
          return (
            '<button class="skbin" data-bin="' +
            esc(b.id) +
            '"><span class="skbinkey">' +
            (i + 1) +
            "</span><span class='skbinlabel'>" +
            esc(b.label) +
            "</span></button>"
          );
        })
        .join("") +
      "</div>";

    var bar = stage.querySelector("#skQTimer i");
    setTimeout(function () {
      if (!reduce) bar.style.transition = "width " + it.seconds + "s linear";
      bar.style.width = "0%";
    }, 30);
    clearInterval(s.timerId);
    s.timerId = setInterval(function () {
      left--;
      if (left > 0 || !live()) return;
      clearInterval(s.timerId);
      s.timerId = 0;
      answer(null, true);
    }, 1000);

    function labelOf(id) {
      var b = null;
      it.bins.forEach(function (x) {
        if (x.id === id) b = x;
      });
      return b ? b.label : "—";
    }
    function answer(binId, timedOut) {
      if (done || !live()) return;
      done = true;
      clearInterval(s.timerId);
      s.timerId = 0;
      var ok = binId === it.answerBin;
      var fast = ok && left > it.seconds / 2;
      var html =
        "<div class='note'>" +
        (timedOut && !binId
          ? "⏱️ Hết giờ."
          : "Bạn chọn <b>" + esc(labelOf(binId)) + "</b>.") +
        " Ô đúng: <b>" +
        esc(labelOf(it.answerBin)) +
        "</b></div>" +
        "<div class='note'>💡 " +
        esc(it.why) +
        "</div>" +
        (ok && fast ? "<div class='note'>⚡ Nhanh tay +5 EXP</div>" : "");
      stage.querySelectorAll(".skbin").forEach(function (n) {
        if (n.dataset.bin === it.answerBin) n.classList.add("ok");
        else if (n.dataset.bin === binId) n.classList.add("no");
      });
      /* Thẻ không gắn key nên không ghi vào lịch sử câu hỏi — chỉ là phản xạ. */
      ctx.finish(ok, html, ok ? (fast ? 15 : 10) : 0, it);
    }
    stage.querySelectorAll("[data-bin]").forEach(function (b) {
      b.onclick = function () {
        answer(b.dataset.bin, false);
      };
    });
    function onKey(e) {
      if (!ctx.alive(myI)) {
        document.removeEventListener("keydown", onKey);
        return;
      }
      var n = parseInt(e.key, 10);
      if (!(n >= 1 && n <= it.bins.length)) return;
      e.preventDefault();
      answer(it.bins[n - 1].id, false);
    }
    document.addEventListener("keydown", onKey);

    /* Kéo thẻ bằng Pointer Events: thả trúng ô thì chọn, thả ra ngoài thì thẻ
       về chỗ cũ và không mất mạng. */
    var node = stage.querySelector("#skQCard");
    var drag = null;
    node.style.touchAction = "none";
    function stopDrag() {
      drag = null;
      node.classList.remove("drag");
      if (!reduce) node.style.transform = "";
    }
    node.addEventListener("pointerdown", function (e) {
      if (!live()) return;
      drag = { x: e.clientX, y: e.clientY };
      try {
        node.setPointerCapture(e.pointerId);
      } catch (err) {}
      node.classList.add("drag");
      e.preventDefault();
    });
    node.addEventListener("pointermove", function (e) {
      if (!drag) return;
      node.style.transform =
        "translate(" + (e.clientX - drag.x) + "px," + (e.clientY - drag.y) + "px)";
    });
    node.addEventListener("pointerup", function (e) {
      if (!drag) return;
      var over = document.elementFromPoint(e.clientX, e.clientY);
      var bin = over && over.closest ? over.closest("[data-bin]") : null;
      stopDrag();
      if (bin) answer(bin.dataset.bin, false);
    });
    node.addEventListener("pointercancel", stopDrag);
    node.addEventListener("keypress", function (e) {
      if (e.key === "Enter" || e.key === " ") e.preventDefault();
    });
  }

  var PLAY = {
    spot: playSpot,
    classpos: playClassify,
    classtense: playClassify,
    classprep: playClassify,
  };

  /* ========== 6. CSS của hai nhóm trò (build.js chèn vào <style>) ========== */
  var CSS = `/* ---- Tìm lỗi sai / Phân loại nhanh (skill-extra.js) ---- */
      .skstep {
        font-weight: 700;
        margin: 2px 0 10px;
      }
      .skword {
        display: inline-block;
        min-width: 34px;
        padding: 7px 8px;
        margin: 2px;
        font: inherit;
        font-size: 17px;
        line-height: 1.3;
        text-align: center;
        border: 2px solid transparent;
        border-radius: 9px;
        background: var(--bg);
        color: inherit;
        cursor: pointer;
      }
      .skword:hover:not(:disabled) {
        border-color: var(--skc);
        background: var(--skc-soft);
      }
      .skword:disabled {
        cursor: default;
      }
      .skword.miss {
        border-color: var(--bad);
        background: color-mix(in srgb, var(--bad) 12%, transparent);
        text-decoration: line-through;
        color: var(--muted);
      }
      .skword.err {
        border-color: var(--bad);
        background: color-mix(in srgb, var(--bad) 22%, transparent);
        font-weight: 700;
        text-decoration: underline wavy var(--bad);
      }
      .skword.fixed {
        border-color: var(--ok);
        background: color-mix(in srgb, var(--ok) 22%, transparent);
        font-weight: 700;
        cursor: default;
      }
      .skfixrow {
        margin-top: 12px;
      }
      .skqwrap {
        display: flex;
        justify-content: center;
        margin: 4px 0 2px;
      }
      .skqcard {
        font-size: 21px;
        font-weight: 700;
        line-height: 1.5;
        text-align: center;
        background: var(--bg);
        border: 2px solid var(--line);
        border-radius: 14px;
        padding: 16px 18px;
        max-width: 560px;
        cursor: grab;
        user-select: none;
      }
      .skqcard.drag {
        cursor: grabbing;
        border-color: var(--skc);
        opacity: 0.92;
      }
      .skqblank {
        display: inline-block;
        min-width: 62px;
        border-bottom: 3px solid var(--skc);
        margin: 0 4px;
        color: var(--muted);
      }
      .skqword {
        font-size: 30px;
        letter-spacing: 0.5px;
      }
      .skfocus {
        background: var(--skc-soft);
        border-radius: 6px;
        padding: 0 4px;
      }
      .skbinrow {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        margin-top: 12px;
      }
      .skbinrow.few {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .skbin {
        min-height: 56px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
        font: inherit;
        font-size: 17px;
        font-weight: 700;
        border: 2px solid var(--line);
        border-radius: 14px;
        background: var(--bg);
        color: inherit;
        cursor: pointer;
      }
      .skbin:hover:not(:disabled) {
        border-color: var(--skc);
        background: var(--skc-soft);
      }
      .skbin .skbinkey {
        font-size: 11px;
        font-weight: 700;
        color: var(--muted);
        border: 1px solid var(--line);
        border-radius: 99px;
        padding: 0 6px;
      }
      .skbin.ok {
        border-color: var(--ok);
        background: color-mix(in srgb, var(--ok) 16%, transparent);
      }
      .skbin.no {
        border-color: var(--bad);
        background: color-mix(in srgb, var(--bad) 16%, transparent);
      }
      @media (max-width: 420px) {
        .skbinrow.few {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .skbin {
          font-size: 15px;
        }
        .skqcard {
          font-size: 19px;
          padding: 14px 12px;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .sktimer i,
        .skqcard,
        .skbin,
        .skword {
          transition: none !important;
        }
      }`;

  return {
    META: META,
    PLAY: PLAY,
    build: build,
    audit: audit,
    CSS: CSS,
    /* lộ ra cho test */
    _internal: {
      assemble: assemble,
      buildSpotItems: buildSpotItems,
      buildClassItems: buildClassItems,
      rawCards: function (kind, pool, deps) {
        return rawCards(kind, pool, deps, null);
      },
      PREP_RULES: PREP_RULES,
      AMBIGUOUS: AMBIGUOUS,
      LY_ADJ: LY_ADJ,
      mulberry: mulberry,
    },
  };
});
