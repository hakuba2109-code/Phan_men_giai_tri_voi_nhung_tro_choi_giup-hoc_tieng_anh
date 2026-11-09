/* Bộ giải thích "miễn phí": phân tích một câu trắc nghiệm chỉ từ dữ liệu đã có
   trong ngân hàng câu hỏi (đề bài, 4 lựa chọn, đáp án đúng, chủ điểm) cộng với
   danh sách từ vựng của chính bộ đề. Không gọi AI, không tốn token, dùng chung
   cho trình duyệt (buildToeic) và Node.js (script nạp dữ liệu).
   Nguyên tắc an toàn: chỉ khẳng định "chỗ trống cần X" khi lớp từ của ĐÁP ÁN ĐÚNG
   khớp với X; suy luận không chắc thì chỉ liệt kê thông tin, không dạy sai. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ToeicExplainer = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var LETTERS = ["A", "B", "C", "D", "E", "F"];
  var POS_VI = {
    noun: "danh từ",
    person: "danh từ chỉ người",
    verb: "động từ",
    adjective: "tính từ",
    adverb: "trạng từ",
    preposition: "giới từ",
    conjunction: "liên từ",
    pronoun: "đại từ",
  };

  function norm(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9'\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  function endsWithAny(w, list) {
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (w.length > e.length + 2 && w.slice(-e.length) === e) return e;
    }
    return "";
  }
  function words(s) {
    return norm(s).split(" ").filter(Boolean);
  }
  // Lựa chọn là cả một câu (đọc hiểu, nghe, ML) => không phân tích được bằng luật từ.
  function isSentenceLike(list) {
    return (list || []).some(function (o) {
      var s = String(o || "").trim();
      return words(s).length > 4 || /[.?!]$/.test(s);
    });
  }

  /* ---------- 1. Lớp từ theo đuôi ---------- */
  var ADJ_ENDING_IN_LY = {
    friendly: 1, lovely: 1, lonely: 1, lively: 1, ugly: 1, silly: 1, holy: 1,
    early: 1, only: 1, costly: 1, weekly: 1, daily: 1, monthly: 1, yearly: 1,
    elderly: 1, brotherly: 1, orderly: 1,
  };
  var NOUN_END = ["ation", "ition", "tion", "sion", "ment", "ness", "ity", "ance",
    "ence", "ancy", "ency", "dom", "hood", "ship", "ism", "ure", "age", "cy"];
  // Đuôi "-age" nhưng bản thân là động từ: không được dán nhãn danh từ.
  var VERB_AGE = { manage: 1, engage: 1, encourage: 1, discourage: 1, damage: 1, emerge: 1 };
  var PERSON_END = ["ist", "ee", "ian", "or", "er", "ant", "ent"];
  var ADJ_END = ["able", "ible", "ious", "ous", "ive", "ical", "ic", "ish", "ary",
    "ful", "less", "al", "ent", "ant", "ing", "ed", "y"];
  var VERB_END = ["ize", "ise", "ify", "ate", "eed", "ain", "ete"];
  // Động từ thông dụng không có đuôi nhận dạng được (hire, submit, notify…).
  var VERB_WORDS = ("hire buy sell rent lend send offer provide adjust submit notify inform remind " +
    "require request deliver ship mail print copy repair replace return refund cancel confirm attend " +
    "join visit tour inspect hire employ train teach learn study read write sign charge report " +
    "review revise update upload download install launch open close start stop finish begin accept " +
    "deny allow forbid advise warn thank welcome introduce support oppose back cover protect " +
    "attack defeat win lose gain earn cost spend save invest waste use apply extend widen reduce " +
    "raise drop fix set put get make take give show hide keep hold carry bring fetch push pull " +
    "check test try plan design build create found grow plant harvest cook clean wash paint " +
    "travel arrive depart board transfer connect switch count weigh measure price value stock " +
    "exhaust expel extract exempt recommend command demand commend retain oversee overlook " +
    "compile distribute forward attach enclose advertise sponsor host organize coordinate " +
    "supervise evaluate assess monitor maintain manufacture purchase lease reserve schedule " +
    "postpone delay reschedule renew terminate dismiss promote recruit interview nominate " +
    "elect appoint assign allocate dispatch display exhibit publish broadcast transmit " +
    "upgrade downgrade troubleshoot customize personalize standardize localize relocate").split(" ");
  // Đuôi -y trông như trạng từ nhưng lại là ĐỘNG TỪ: comply with, apply for, reply…
  var VERB_LY = {};
  ("comply apply reply imply supply rely multiply fly")
    .split(" ")
    .forEach(function (w) { VERB_LY[w] = 1; });
  // Từ nối/giới từ ngắn: nhận dạng thẳng, không đoán theo đuôi.
  var FIXED = {
    because: "conjunction", although: "conjunction", though: "conjunction",
    while: "conjunction", unless: "conjunction", whereas: "conjunction",
    whether: "conjunction", however: "adverb", therefore: "adverb",
    moreover: "adverb", otherwise: "adverb", meanwhile: "adverb", thus: "adverb",
    and: "conjunction", or: "conjunction", but: "conjunction", so: "conjunction",
    of: "preposition", in: "preposition", on: "preposition", at: "preposition",
    to: "preposition", for: "preposition", from: "preposition", with: "preposition",
    by: "preposition", about: "preposition", into: "preposition",
    upon: "preposition", during: "preposition", until: "preposition",
    against: "preposition", between: "preposition", among: "preposition",
    without: "preposition", within: "preposition", across: "preposition",
    through: "preposition", over: "preposition", under: "preposition",
    than: "conjunction", as: "preposition", like: "preposition",
  };

  // Danh từ tận cùng -y (rất hay bị đoán nhầm là tính từ theo đuôi -y).
  var NOUN_Y = {};
  ("energy policy agency emergency legacy ministry industry diary summary ceremony " +
    "memory injury royalty discovery delivery facility opportunity community unity " +
    "quality quantity identity publicity entry country party penalty " +
    "safety beauty loyalty anxiety vacancy intimacy")
    .split(" ")
    .forEach(function (w) { NOUN_Y[w] = 1; });
  // Đuôi mơ hồ: một đuôi có thể thuộc nhiều lớp từ. Chỉ được loại một lựa chọn
  // khi lớp mà chỗ trống CẦN không nằm trong các lớp khả dĩ của đuôi đó.
  var PLAUSIBLE = {
    al: ["noun", "adjective"], ary: ["noun", "adjective"], ory: ["noun", "adjective"],
    ent: ["noun", "adjective"], ant: ["noun", "adjective"],
    ive: ["noun", "adjective"], able: ["adjective"], ible: ["adjective"],
    ous: ["adjective"], ious: ["adjective"], ic: ["adjective"], ish: ["adjective"],
    ful: ["adjective"], less: ["adjective"], y: ["noun", "adjective"],
    ing: ["adjective", "noun", "verb"], ed: ["adjective", "verb"],
    ate: ["verb", "noun", "adjective"], ite: ["noun", "adjective"],
    age: ["noun", "verb"], er: ["noun", "adjective"], est: ["adjective"],
    ly: ["adverb"], ise: ["verb"], ize: ["verb"], ify: ["verb"],
    tion: ["noun"], sion: ["noun"], ation: ["noun"], ition: ["noun"],
    ment: ["noun"], ness: ["noun"], ity: ["noun"], ance: ["noun"], ence: ["noun"],
    ure: ["noun"], dom: ["noun"], hood: ["noun"], ship: ["noun"], ism: ["noun"],
  };
  function plausibleClasses(word) {
    var w = words(word)[0];
    if (!w) return [];
    if (NOUN_Y[w]) return ["noun"];
    if (VERB_LY[w]) return ["verb"];
    var best = "";
    Object.keys(PLAUSIBLE).forEach(function (e) {
      if (w.length > e.length + 2 && w.slice(-e.length) === e && e.length > best.length) best = e;
    });
    return best ? PLAUSIBLE[best] : [];
  }
  function canRuleOut(word, need) {
    var p = plausibleClasses(word);
    if (!p.length) return false;
    if (need === "noun") return p.indexOf("noun") < 0 && p.indexOf("person") < 0;
    if (need === "person") return p.indexOf("person") < 0 && p.indexOf("noun") < 0;
    return p.indexOf(need) < 0;
  }

  function classOf(word, familyRoot, allowBareVerb) {
    var ws = words(word);
    var w = ws[0];
    if (!w) return null;
    // Chỉ phân loại từ đơn. "In the lobby" là cả cụm trạng ngữ, dán nhãn giới từ
    // chỉ vì chữ "In" đầu tiên sẽ thành nói sai.
    if (ws.length > 1) return null;
    if (FIXED[w]) return FIXED[w];
    if (ADJ_ENDING_IN_LY[w]) return "adjective";
    if (NOUN_Y[w]) return "noun";
    if (familyRoot && w === familyRoot) return "verb";
    if (endsWithAny(w, VERB_END)) return "verb";
    if (VERB_LY[w]) return "verb";
    if (w.slice(-2) === "ly") return "adverb";
    if (VERB_AGE[w]) return "verb";
    if (endsWithAny(w, NOUN_END)) return "noun";
    if (familyRoot && endsWithAny(w, PERSON_END)) return "person";
    if (endsWithAny(w, ADJ_END)) return "adjective";
    // Chỉ dùng khi cần biết "từ này làm động từ được không" (nhiều từ vừa là
    // danh từ vừa là động từ: report, charge, price…) nên không bật mặc định.
    if (allowBareVerb && VERB_WORDS.indexOf(w) >= 0) return "verb";
    return null;
  }

  // Rễ chung dài nhất của 4 lựa chọn (sustain… , compet…).
  function commonRoot(list) {
    var ws = list.map(function (s) { return words(s)[0]; });
    if (ws.some(function (w) { return !w; })) return "";
    var root = ws[0];
    for (var i = 1; i < ws.length; i++) {
      while (root.length > 3 && ws[i].slice(0, root.length) !== root)
        root = root.slice(0, -1);
    }
    return root.length >= 4 ? root : "";
  }

  // Family từ loại chuẩn: mọi lựa chọn cùng rễ và mỗi cái một lớp từ khác nhau.
  function isFamily(options) {
    var root = commonRoot(options);
    if (!root) return "";
    var ws = options.map(function (o) { return words(o)[0]; });
    // Chỉ được coi từ trùng với gốc là ĐỘNG TỪ khi có căn cứ (hire/compete…);
    // nếu không (strict, quick…) thì đừng gán bừa -er/-est là "chỉ người".
    var bareIsVerb = ws.indexOf(root) < 0 || VERB_WORDS.indexOf(root) >= 0 ||
      !!IRREGULAR[root] ||
      ws.some(function (w) { return w !== root && endsWithAny(w, VERB_END); });
    var effRoot = bareIsVerb ? root : "";
    var cls = options.map(function (o) { return classOf(o, effRoot); });
    if (cls.some(function (c) { return !c; })) return "";
    var uniq = {};
    cls.forEach(function (c) { uniq[c] = 1; });
    return Object.keys(uniq).length >= 3 ? root : "";
  }

  /* ---------- 2. Chỗ trống cần lớp từ gì ---------- */
  var DET = ["a", "an", "the", "this", "that", "these", "those", "each", "every",
    "some", "any", "no", "all", "both", "another", "other", "more", "most",
    "much", "many", "few", "little", "our", "their", "his", "her", "its",
    "my", "your", "whose"];
  var AUX = ["is", "are", "was", "were", "be", "been", "being", "seem", "seems",
    "seemed", "look", "looks", "looked", "appear", "appears", "appeared",
    "become", "becomes", "feel", "feels", "felt", "remain", "remains"];
  var MODAL = ["can", "could", "will", "would", "shall", "should", "may",
    "might", "must", "do", "does", "did"];
  var HAVE = ["have", "has", "had"];
  // "decide/intend/plan + to + V" là nguyên thể; trái lại "look forward to",
  // "be dedicated to", "the key to" là giới từ + danh từ — không được khẳng định
  // bừa, nên chỉ nhận diện theo động từ nối (catenative verb) đã liệt kê.
  var TO_VERB = {};
  ("decide intend plan want need hope expect agree refuse offer promise arrange choose attempt " +
    "manage learn help ask allow permit advise encourage prepare threaten claim fail continue " +
    "try use like love hate prefer request demand urge order enable cause force invite aim " +
    "strive mean seem appear happen start begin cease decline determine resolve undertake " +
    "guarantee guarantee neglect desire intend tend endeavor").split(" ")
    .forEach(function (w) { TO_VERB[w] = 1; });
  function toVerbLike(w) {
    if (!w) return false;
    if (TO_VERB[w] || HAVE.indexOf(w) >= 0 || MODAL.indexOf(w) >= 0) return true;
    if (/^(be|been|being|go|going|went|come|coming|came)$/.test(w)) return true;
    var st = [w, w.replace(/s$/, ""), w.replace(/es$/, ""), w.replace(/ies$/, "y"),
      w.replace(/ed$/, ""), w.replace(/d$/, ""), w.replace(/ing$/, ""), w.replace(/e$/, "")];
    for (var i = 0; i < st.length; i++)
      if (st[i] && (TO_VERB[st[i]] || VERB_WORDS.indexOf(st[i]) >= 0)) return true;
    return VERB_WORDS.indexOf(w) >= 0;
  }

  function parts(stem) {
    var s = String(stem || "");
    var m = s.match(/_{2,}|\.\.\.\.+|\[\s*\]/);
    if (!m) return null;
    return {
      pre: s.slice(0, m.index).replace(/[\s"”'’]+$/, ""),
      post: s.slice(m.index + m[0].length).replace(/^[\s"”'’]+/, ""),
    };
  }
  function lastWord(s, skipDet) {
    var ws = words(s);
    for (var i = ws.length - 1; i >= 0; i--) {
      if (skipDet && DET.indexOf(ws[i]) >= 0) continue;
      return ws[i];
    }
    return "";
  }
  function cueOf(p) {
    var pre = words(p.pre).slice(-4).join(" ");
    var post = words(p.post).slice(0, 3).join(" ");
    return (pre ? "… " + pre : "") + " ______" + (post ? " " + post + " …" : "");
  }
  function endsWithWord(pre, list) {
    var tail = words(pre).slice(-1)[0] || "";
    return list.indexOf(tail) >= 0 ? tail : "";
  }

  function slotNeed(p, answerClass, answerWord) {
    var pre = p.pre, post = p.post;
    var tail = words(pre).slice(-1)[0] || "";
    var beforeTail = words(pre).slice(-2)[0] || "";
    var fw = words(post)[0] || "";
    var fwClass = classOf(fw);
    var need = "", why = "", passive = false;

    if (endsWithWord(pre, MODAL)) {
      need = "verb";
      why = "sau trợ động từ “" + tail + "” cần động từ nguyên thể";
    } else if (endsWithWord(pre, HAVE)) {
      need = "verb";
      why = "sau “" + tail + "” (thì hoàn thành) cần quá khứ phân từ";
    } else if (/\bby\s*$/.test(norm(pre) + " ") ||
      /\b(be|been|being|is|are|am|was|were)\s+$/.test(norm(pre) + " ") && /^\s*by\b/.test(norm(post))) {
      need = "verb";
      why = "cấu trúc bị động (“" + tail + " + … + by”) cần quá khứ phân từ";
      passive = true;
    } else if (endsWithWord(pre, AUX) && fw && fwClass !== "adverb") {
      need = "adjective";
      why = "sau “" + tail + "” cần tính từ làm bổ ngữ cho chủ ngữ";
    } else if (/\b(very|so|too|quite|really|extremely|rather|more|most)\s+$/.test(norm(pre) + " ")) {
      need = "adjective";
      why = "sau trạng từ chỉ mức độ “" + tail + "” cần tính từ";
    } else if (/^that\b/.test(norm(post)) && words(pre).length >= 2 &&
      answerClass === "verb") {
      need = "verb";
      why = "đứng sau chủ ngữ và trước mệnh đề “that …” nên chỗ trống là ĐỘNG TỪ chính của câu";
    } else if (/\ba\s+\w+(ing|ed)\s+$|\ban?\s+\w+\s+of\s+\w+\s+$/.test(norm(pre) + " ")) {
      need = "noun";
      why = "“" + words(pre).slice(-3).join(" ") + "” là cụm danh từ nên chỗ trống cần danh từ";
    } else if (/ly$/.test(tail) && fw && fwClass === "noun") {
      need = "adjective";
      why = "tính từ bổ nghĩa cho danh từ “" + fw + "”";
    } else if (DET.indexOf(tail) >= 0) {
      if (!fw) {
        need = "noun";
        why = "sau “" + tail + "” và đứng cuối câu cần danh từ";
      } else if (MODAL.concat(HAVE, AUX).indexOf(fw) >= 0) {
        need = "noun";
        why = "“" + tail + " ______” đang ở vị trí chủ ngữ nên cần danh từ";
      } else if (fwClass === "noun") {
        need = "adjective";
        why = "giữa mạo từ “" + tail + "” và danh từ “" + fw + "” cần tính từ";
      } else {
        need = "noun";
        why = "sau mạo từ/từ hạn định “" + tail + "” cần danh từ";
      }
    } else if (/\bto\s+$/.test(norm(pre) + " ")) {
      // "to" đứng sau một động từ là to-infinitive; sau tính từ/danh từ (key to,
      // dedicated to, look forward to) thì nó là giới từ và cần danh từ/V-ing.
      var beforeTo = words(pre).slice(-2)[0] || "";
      var ansW0 = words(answerWord || "")[0] || "";
      // Tín hiệu nằm ở từ TRƯỚC "to" (decided to, agreed to…), nên vẫn dùng được
      // khi đáp án không có đuôi nhận dạng được; chỉ né khi đáp án là V-ing.
      if (toVerbLike(beforeTo) && answerClass !== "noun" && answerClass !== "person" &&
        !/ing$/.test(ansW0)) {
        need = "verb";
        why = "“" + beforeTo + " to” cần động từ nguyên thể";
      } else if ((answerClass === "noun" || answerClass === "person") && !toVerbLike(beforeTo)) {
        need = "noun";
        why = "“to” ở đây là giới từ nên sau nó cần danh từ (hoặc V-ing)";
      }
    } else if (/\b(of|for|in|on|at|with|about|from|as|like)\s+$/.test(norm(pre) + " ")) {
      need = "noun";
      why = "sau giới từ “" + tail + "” cần danh từ (hoặc V-ing)";
    } else if (classOf(tail) === "adjective" && !/(ed|ing)$/.test(tail) &&
      words(pre).length >= 2 && ["a", "an", "the"].indexOf(beforeTail) < 0 &&
      !/\b(is|are|was|were|be|been|being|seem|seems|seemed|appear|appears|appeared|become|becomes|became|look|looks|looked|feel|feels|felt|remain|remains|remained|prove|proves|turn|turns|turned)\s+$/.test(
        norm(pre) + " ") &&
      !/\b(very|so|too|quite|really|extremely|rather|more|most|less)\s+\w+$/.test(norm(pre) + " ")) {
      need = "noun";
      why = "đứng ngay sau tính từ “" + tail + "” nên chỗ trống là DANH TỪ mà tính từ đó bổ nghĩa";
    } else if (!fw && words(pre).length >= 4) {
      need = "adverb";
      why = "chỗ trống cuối câu, bổ nghĩa cho động từ nên cần trạng từ";
    }
    if (!need) return null;
    return { need: need, why: why, cue: cueOf(p), passive: passive };
  }

  /* ---------- 3. Cụm cố định + nghĩa tiếng Việt ---------- */
  var COLLOC = {
    participate: "in", join: "in", engage: "in", specialize: "in", succeed: "in",
    invest: "in", involve: "in", interest: "in", believe: "in", trust: "in",
    excel: "in", involved: "in", experienced: "in", increase: "in", decrease: "in",
    rise: "in", fall: "in", growth: "in", change: "in", difference: "in",
    depend: "on", rely: "on", count: "on", focus: "on", insist: "on", base: "on",
    spend: "on", concentrate: "on", decide: "on", comment: "on", impact: "on",
    effect: "on", influence: "on", decision: "on", based: "on",
    consist: "of", deprive: "of", accuse: "of", suspect: "of", think: "of",
    dream: "of", aware: "of", capable: "of", proud: "of", fond: "of",
    afraid: "of", tired: "of", full: "of", shortcut: "of", advantage: "of",
    disadvantage: "of", possibility: "of", chance: "of", choice: "of",
    belong: "to", apply: "to", relate: "to", refer: "to", prefer: "to",
    contribute: "to", lead: "to", object: "to", attend: "to", thanks: "to",
    dedicated: "to", committed: "to", similar: "to", opposite: "to",
    married: "to", key: "to", access: "to", answer: "to", solution: "to",
    agree: "with", comply: "with", cope: "with", deal: "with", compare: "with",
    replace: "with", provide: "with", satisfy: "with", argue: "with",
    account: "for", apply: "for", ask: "for", prepare: "for", pay: "for",
    thank: "for", apologize: "for", blame: "for", responsible: "for",
    famous: "for", suitable: "for", ready: "for", reason: "for", need: "for",
    demand: "for", search: "for", look: "for", wait: "for", hope: "for",
    opportunity: "for", time: "for",
    listen: "to", respond: "to", react: "to", identify: "with",
    eliminate: "from", exclude: "from", remove: "from", derive: "from",
    differ: "from", different: "from", graduate: "from", separate: "from",
    escape: "from",
    good: "at", bad: "at", skilled: "at", surprised: "by", excited: "about",
    worried: "about", concerned: "about", angry: "about", curious: "about",
  };
  var PHRASES = [
    ["in search of", "tìm kiếm"], ["in addition to", "ngoài … ra còn"],
    ["because of", "bởi vì"], ["due to", "do, tại"], ["owing to", "nhờ"],
    ["instead of", "thay vì"], ["according to", "theo như"],
    ["as well as", "cũng như"], ["such as", "chẳng hạn như"],
    ["in terms of", "về mặt"], ["in front of", "ở phía trước"],
    ["in charge of", "phụ trách"], ["in spite of", "mặc dù"],
    ["regardless of", "bất kể"], ["by means of", "bằng cách"],
    ["look forward to", "háo hức chờ"], ["take part in", "tham gia"],
    ["take care of", "chăm lo"], ["pay attention to", "chú ý tới"],
    ["get rid of", "loại bỏ"], ["in the middle of", "giữa"],
    ["on behalf of", "thay mặt"], ["with respect to", "liên quan tới"],
    ["make sure of", "bảo đảm"], ["at least", "ít nhất"],
    ["in general", "nhìn chung"], ["out of", "ra khỏi"],
  ];
  var PREP_VI = {
    of: "của", for: "cho", to: "tới, đến", in: "trong", on: "trên, vào",
    at: "tại", with: "với", about: "về", from: "từ", by: "bởi, bằng",
    as: "như", than: "hơn", like: "như", into: "vào trong", upon: "trên",
    during: "trong suốt", since: "từ khi", until: "cho tới",
    against: "chống lại", between: "giữa", among: "trong số",
    without: "không có", within: "trong vòng", across: "ngang qua",
    through: "qua", over: "hơn, trên", under: "dưới",
  };
  // Giới từ chỉ có một chữ/không theo đuôi: nhận dạng thẳng để biết khi nào
  // cả 4 lựa chọn đều là giới từ (=> câu kiểm tra cách dùng, không kiểm tra từ loại).
  var EXTRA_PREP = {
    off: 1, inside: 1, outside: 1, near: 1, beside: 1, beyond: 1, except: 1,
    despite: 1, per: 1, via: 1, onto: 1, past: 1, toward: 1, towards: 1,
    along: 1, around: 1, aboard: 1, versus: 1, since: 1, for: 1, up: 1,
    down: 1, behind: 1, above: 1, below: 1, against: 1, throughout: 1,
    considering: 1, regarding: 1, during: 1, before: 1, after: 1, till: 1,
    beneath: 1, unlike: 1, without: 1, within: 1, past: 1, worth: 1,
  };
  // Cách dùng điển hình — chỉ ghi những điều đúng mọi ngữ cảnh.
  var PREP_USE = {
    in: "in + tháng/năm/mùa, hoặc ở trong không gian kín",
    on: "on + ngày hoặc thứ trong tuần, trên bề mặt",
    at: "at + giờ, một địa điểm/độ tuổi cụ thể",
    from: "chỉ nguồn gốc hoặc điểm bắt đầu (return from, come from)",
    to: "chỉ hướng/đích đến; cũng là “to” của nguyên thể",
    for: "cho; trong khoảng thời gian (for 3 years)",
    since: "từ một mốc thời gian (đi với thì hoàn thành)",
    by: "bởi (câu bị động); chậm nhất là (mốc thời hạn)",
    with: "cùng với, mang theo",
    about: "về một chủ đề; khoảng (số lượng)",
    during: "trong suốt một sự kiện (during the meeting)",
    until: "cho đến khi (until Friday)",
    between: "giữa hai đối tượng",
    among: "trong số ba đối tượng trở lên",
    across: "ngang qua, bên kia",
    through: "xuyên qua, qua hết",
    over: "qua, hơn (số lượng), ở trên",
    under: "dưới, dưới quyền",
    into: "vào bên trong (có chuyển động)",
    onto: "lên trên bề mặt (có chuyển động)",
    above: "cao hơn, trên mức",
    below: "thấp hơn, dưới mức",
    beyond: "vượt quá",
    despite: "bất chấp (despite + danh từ/V-ing)",
    except: "ngoại trừ",
    before: "trước (thời gian hoặc vị trí)",
    after: "sau (thời gian hoặc vị trí)",
    till: "cho đến khi (= until)",
    unlike: "không giống như",
    via: "thông qua, đi qua",
    per: "mỗi (per person)",
  };

  function phraseMeaning(phrase) {
    for (var i = 0; i < PHRASES.length; i++)
      if (PHRASES[i][0] === phrase) return PHRASES[i][1];
    return "";
  }
  function optionMeaning(option) {
    var w = norm(option);
    var p = phraseMeaning(w);
    if (p) return p;
    var first = words(w)[0];
    return PREP_VI[first] || "";
  }
  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function prepAnalysis(p, options, aIdx, glossary) {
    var pre = norm(p.pre), ans = norm(options[aIdx]);
    var head = "", note = "";
    // 1) danh sách từ của chính bộ đề có cụm "… + giới từ/từ nhỏ" này
    var tailWords = words(pre);
    for (var t = 1; t <= 3 && !note; t++) {
      var frag = tailWords.slice(-t).join(" ");
      var g = glossary && glossary[norm(frag + " " + ans)];
      if (g) {
        head = frag;
        note = "Theo danh sách từ của bộ đề: “" + g.term + "” = " + g.vi + ".";
      }
    }
    // 2) chỗ trống khép lại một cụm cố định dài ("in search ___" + of)
    var post = norm(p.post);
    for (var i = 0; i < PHRASES.length && !note; i++) {
      var ph = PHRASES[i][0].split(" ");
      var last = ph[ph.length - 1];
      var before = ph.slice(0, -1).join(" ");
      if (ans === last && new RegExp("(^|\\s)" + escapeRe(before) + "\\s+$").test(pre + " ")) {
        head = before;
        note = "Cụm cố định “" + before + " " + last + "” = " + PHRASES[i][1] + ".";
      } else if (ans === ph[0] && new RegExp("^" + escapeRe(ph.slice(1).join(" ")) + "(\\s|$)").test(post)) {
        head = ph.slice(1).join(" ");
        note = "Cụm cố định “" + ans + " " + ph.slice(1).join(" ") + "” = " + PHRASES[i][1] + ".";
      }
    }
    // 3) từ đứng ngay trước chỗ trống quy định giới từ
    if (!note) {
      var lw = lastWord(pre, true);
      if (COLLOC[lw] && COLLOC[lw] === ans) {
        head = lw;
        note = "Cụm cố định: “" + lw + " + " + ans + "”.";
      }
    }
    // 4) in / on / at chỉ thời gian
    if (!note) {
      var rest = post;
      var hasDay = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|fri|sat|sun)\b/.test(rest);
      var hasDate = /\b\d{1,2}(st|nd|rd|th)?\s+(of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\w*\b/.test(rest);
      var hasMonth = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/.test(rest);
      var hasYear = /(^|\s)(19|20)\d\d\b/.test(rest);
      var hasClock = /\b\d{1,2} \d{2}\b|\b(midnight|noon)\b/.test(rest);
      var hasPeriod = /\b(morning|afternoon|evening|summer|winter|spring|autumn|year|decade|century|future|past|month)\b/.test(rest);
      if (ans === "at" && (hasClock || /\b(midnight|noon|night|the moment|least|most|the same|age)\b/.test(rest))) {
        head = "at"; note = "at + mốc thời gian (“at " + words(rest)[0] + "”).";
      } else if (ans === "on" && (hasDay || hasDate || /\b(date|weekday|weekend|shift|duty)\b/.test(rest))) {
        head = "on"; note = "on + ngày hoặc thứ trong tuần (“on " + words(rest)[0] + "”).";
      } else if (ans === "in" && (hasMonth || hasYear || hasPeriod)) {
        head = "in"; note = "in + tháng/năm/mùa/buổi (“in " + words(rest)[0] + "”).";
      }
    }
    if (!note) return null;
    var byTime = head === "in" || head === "on" || head === "at";
    return {
      kind: "prep",
      head: [note],
      options: options.map(function (o, k) {
        var m = optionMeaning(o);
        return LETTERS[k] + ". " + o + (m ? " (" + m + ")" : "") + (k === aIdx ? " ✅" :
          byTime ? " — không dùng với mốc thời gian này" : " — không đi với “" + head + "”");
      }),
    };
  }

  /* ---------- 4. Đại từ ---------- */
  var PRON = {
    i: ["subject", "tôi"], me: ["object", "tôi"], my: ["possadj", "của tôi"],
    mine: ["posspron", "của tôi"], myself: ["reflexive", "chính tôi"],
    you: ["both", "bạn"], your: ["possadj", "của bạn"], yours: ["posspron", "của bạn"],
    yourself: ["reflexive", "chính bạn"], yourselves: ["reflexive", "chính các bạn"],
    he: ["subject", "anh ấy"], him: ["object", "anh ấy"], his: ["possadj", "của anh ấy"],
    himself: ["reflexive", "chính anh ấy"],
    she: ["subject", "cô ấy"], her: ["object", "cô ấy"], hers: ["posspron", "của cô ấy"],
    herself: ["reflexive", "chính cô ấy"],
    it: ["both", "nó"], its: ["possadj", "của nó"], itself: ["reflexive", "chính nó"],
    we: ["subject", "chúng tôi"], us: ["object", "chúng tôi"],
    our: ["possadj", "của chúng tôi"], ours: ["posspron", "của chúng tôi"],
    ourselves: ["reflexive", "chính chúng tôi"],
    they: ["subject", "họ"], them: ["object", "họ"], their: ["possadj", "của họ"],
    theirs: ["posspron", "của họ"], themselves: ["reflexive", "chính họ"],
    who: ["relative", "người mà"], whom: ["relative", "người mà (tân ngữ)"],
    whose: ["relative", "của người/người mà"], which: ["relative", "cái mà"],
    what: ["relative", "điều gì"], whoever: ["relative", "bất kỳ ai"],
  };
  var PRON_ROLE = {
    subject: "đại từ làm CHỦ NGỮ (đứng trước động từ)",
    object: "đại từ làm TÂN NGỮ (sau động từ/giới từ)",
    possadj: "tính từ sở hữu, luôn đứng TRƯỚC danh từ",
    posspron: "đại từ sở hữu, đứng MỘT MÌNH (thay cho 'tính từ sở hữu + danh từ')",
    reflexive: "đại từ phản thân (tự, chính …)",
    relative: "đại từ quan hệ (mở đầu mệnh đề quan hệ)",
    both: "dùng được cả làm chủ ngữ lẫn tân ngữ",
  };
  var SUBJ_BY_PERSON = {
    i: "myself", you: "yourself", he: "himself", she: "herself", it: "itself",
    we: "ourselves", they: "themselves",
  };

  function pronounAnalysis(p, options, aIdx) {
    var forms = options.map(function (o) { return PRON[words(o)[0]]; });
    if (forms.some(function (f) { return !f; })) return null;
    var pre = norm(p.pre), fw = words(p.post)[0] || "";
    var type = forms[aIdx][0];
    var lines = [];

    if (/\b(by|enjoy|enjoyed|enjoys|help|helped|prepare|behalf|feel|felt)\s+$/.test(pre) &&
      type === "reflexive") {
      lines.push("Thành ngữ yêu cầu đại từ phản thân sau “" +
        (words(pre).slice(-1)[0] || "") + "” → " + options[aIdx] + ".");
    } else if (type === "possadj" && fw) {
      lines.push("Sau chỗ trống là danh từ “" + fw + "” → cần tính từ sở hữu, không phải đại từ sở hữu đứng một mình.");
    } else if (type === "posspron" && !fw) {
      lines.push("Chỗ trống cuối câu, không còn danh từ nào phía sau → cần đại từ sở hữu (đã bao gồm danh từ).");
    } else if (type === "posspron" && fw && /(^|\s)(of|is|are|was|were)\b/.test(" " + fw + " ")) {
      lines.push("Chỗ trống thay cho cả 'sở hữu + danh từ' (cấu trúc 'theirs of …') → đại từ sở hữu.");
    } else if (type === "reflexive") {
      var subj = words(pre).filter(function (w) { return SUBJ_BY_PERSON[w]; }).pop();
      if (subj) lines.push("Chủ ngữ cùng ngôi (“" + subj + "”) với tân ngữ → dùng phản thân " + options[aIdx] + ".");
      else lines.push("Chỗ trống nhấn mạnh chủ ngữ → đại từ phản thân.");
    } else if (type === "subject") {
      lines.push("Chỗ trống đứng ngay trước động từ → vị trí chủ ngữ.");
    } else if (type === "object" || type === "both") {
      lines.push("Chỗ trống sau động từ/giới từ → vị trí tân ngữ.");
    } else if (type === "relative") {
      lines.push("Chỗ trống mở đầu mệnh đề quan hệ bổ nghĩa cho “" +
        (words(pre).slice(-1)[0] || "") + "”.");
    } else {
      lines.push("Vị trí này cần " + (PRON_ROLE[type] || "đại từ") + ".");
    }
    return {
      kind: "pronoun",
      head: lines,
      options: options.map(function (o, k) {
        return LETTERS[k] + ". " + o + " — " + (PRON_ROLE[forms[k][0]] || forms[k][0]) +
          ", nghĩa: " + forms[k][1] + (k === aIdx ? " ✅" : "");
      }),
    };
  }

  /* ---------- 5. Thì: dấu hiệu thời gian + dạng động từ ---------- */
  var IRREGULAR = {
    be: ["was|were", "been"], begin: ["began", "begun"], break: ["broke", "broken"],
    bring: ["brought", "brought"], build: ["built", "built"], buy: ["bought", "bought"],
    choose: ["chose", "chosen"], come: ["came", "come"], cost: ["cost", "cost"],
    do: ["did", "done"], drink: ["drank", "drunk"], drive: ["drove", "driven"],
    eat: ["ate", "eaten"], fall: ["fell", "fallen"], feel: ["felt", "felt"],
    find: ["found", "found"], fly: ["flew", "flown"], forget: ["forgot", "forgotten"],
    get: ["got", "gotten"], give: ["gave", "given"], go: ["went", "gone"],
    grow: ["grew", "grown"], hear: ["heard", "heard"], keep: ["kept", "kept"],
    know: ["knew", "known"], leave: ["left", "left"], lend: ["lent", "lent"],
    lose: ["lost", "lost"], make: ["made", "made"], mean: ["meant", "meant"],
    meet: ["met", "met"], pay: ["paid", "paid"], put: ["put", "put"],
    read: ["read", "read"], run: ["ran", "run"], say: ["said", "said"],
    see: ["saw", "seen"], sell: ["sold", "sold"], send: ["sent", "sent"],
    show: ["showed", "shown"], speak: ["spoke", "spoken"], spend: ["spent", "spent"],
    take: ["took", "taken"], teach: ["taught", "taught"], tell: ["told", "told"],
    think: ["thought", "thought"], understand: ["understood", "understood"],
    wear: ["wore", "worn"], win: ["won", "won"], write: ["wrote", "written"],
  };
  var TENSE_CUES = [
    [/\b(would(n'?t| not)? have|the day before|in order that \w+ had)\b/, "quá khứ hoàn thành", "past-perfect"],
    [/\bby (next|the end|tomorrow|20\d\d|the time|then)\b/, "tương lai hoàn thành", "perfect-future"],
    [/\b(while|as)\b[^.]{0,30}\b(yesterday|last|was|were)\b/, "quá khứ tiếp diễn", "past-ing"],
    [/\b(yesterday|last (week|month|year|night|quarter|decade|sunday|saturday|tuesday|wednesday|friday|monday)|\d+ (years|months|weeks|days|hours) ago|in (19|20)\d\d|when i was|the other day|at that time|earlier)\b/, "quá khứ đơn", "past"],
    [/\b(since|for \d|already|yet|recently|so far|up to now|until now|ever|never|lately|in (the )?(last|past|recent) \d* ?(years|months|weeks|days)|over the past)\b/, "hiện tại hoàn thành", "pp"],
    [/\b(now|right now|at the moment|currently|at present|presently|these days|today|still)\b/, "hiện tại tiếp diễn", "ing"],
    [/\b(tomorrow|next (week|month|year|time|meeting|quarter)|soon|in \d+ (days|weeks|months|years)|upcoming|the coming (week|month|year))\b/, "tương lai đơn", "future"],
    [/\b(every|usually|often|always|normally|regularly|frequently|typically|generally|each|daily|weekly|monthly|once a|twice a|three times a|on mondays|on a (regular|daily|weekly) basis)\b/, "hiện tại đơn", "present"],
  ];

  var LEMMA_INDEX = (function () {
    var m = {};
    Object.keys(IRREGULAR).forEach(function (base) {
      m[base] = base;
      IRREGULAR[base].forEach(function (f) {
        f.split("|").forEach(function (x) { m[x] = base; });
      });
    });
    return m;
  })();
  var AUX_WORDS = ["will", "would", "shall", "can", "could", "may", "might",
    "must", "should", "have", "has", "had", "be", "been", "being", "is",
    "are", "am", "was", "were", "not"];
  // "phase out" là động từ hai chữ: từ mang thì là từ ĐẦU tiên, không phải từ cuối.
  function verbSlot(x) {
    var ws = x.split(" ");
    for (var i = 0; i < ws.length; i++)
      if (AUX_WORDS.indexOf(ws[i]) < 0) return ws[i];
    return ws[ws.length - 1];
  }

  function verbForm(option) {
    var x = norm(option);
    if (!x) return ["", ""];
    var head = x.split(" ")[0];
    var v = verbSlot(x);
    if (/^(will|would|shall)\s+have\s/.test(x))
      return ["perfect-future", head + " + have + V3 (tương lai hoàn thành)"];
    if (/^(will|would|shall)\s+be\s+\w*ing\b/.test(x))
      return ["future-ing", head + " + be + V-ing (tương lai tiếp diễn)"];
    if (/^(will|would|shall)\s+be\s/.test(x))
      return ["passive-future", head + " + be + V3 (bị động)"];
    if (/^(will|would|shall)\s/.test(x))
      return ["future", head + " + động từ nguyên thể"];
    if (/^(can|could|may|might|must|should)\s+be\s/.test(x))
      return ["passive-modal", head + " + be + V3 (bị động)"];
    if (/^(can|could|may|might|must|should)\s/.test(x))
      return ["base", head + " + động từ nguyên thể"];
    if (/^(is|are|am)\s+\w+$/.test(x)) return ["ing", head + " + V-ing (hiện tại tiếp diễn)"];
    if (/^(was|were)\s+\w+$/.test(x)) return ["past-ing", head + " + V-ing (quá khứ tiếp diễn)"];
    if (/^(have|has)\s+\w+$/.test(x)) return ["pp", head + " + V3 (hiện tại hoàn thành)"];
    if (/^had\s+\w+$/.test(x)) return ["past-perfect", "had + V3 (quá khứ hoàn thành)"];
    if (/^(be|been|being)$/.test(x)) return ["be", "dạng 'be'"];
    if (/^(am|is|are)$/.test(v)) return ["present", "hiện tại đơn của động từ “be”"];
    if (/^(was|were)$/.test(v)) return ["past", "quá khứ đơn của động từ “be”"];
    if (v === "been") return ["pp", "phân từ 2 của động từ “be”"];
    if (v === "be") return ["base", "động từ nguyên thể “be”"];
    if (/ing$/.test(v)) return ["ing", "V-ing"];
    if (/ed$/.test(v)) return ["past", "V-ed (quá khứ đơn hoặc phân từ 2)"];
    if (LEMMA_INDEX[v] && LEMMA_INDEX[v] !== v) {
      var f = IRREGULAR[LEMMA_INDEX[v]];
      var isPast = f[0].split("|").indexOf(v) >= 0;
      return [isPast ? "past" : "pp",
        (isPast ? "quá khứ đơn" : "phân từ 2") + " của " + LEMMA_INDEX[v]];
    }
    if (/ies$/.test(v)) return ["present", "hiện tại đơn, ngôi thứ ba số ít"];
    if (/[^aeiou]es$/.test(v)) return ["present", "hiện tại đơn, ngôi thứ ba số ít"];
    if (/s$/.test(v) && !/ss$/.test(v) && v.length > 3)
      return ["present", "hiện tại đơn, ngôi thứ ba số ít"];
    return ["base", "động từ nguyên thể"];
  }

  // "goes / go / went / going" là một họ từ => câu hỏi về THÌ, không phải từ loại.
  var BE_FORMS = ["be", "am", "is", "are", "was", "were", "been", "being"];
  function lemmaSet(option) {
    var w = verbSlot(norm(option));
    if (!w) return [];
    if (BE_FORMS.indexOf(w) >= 0) return BE_FORMS.slice();
    var out = {};
    out[w] = 1;
    if (LEMMA_INDEX[w]) out[LEMMA_INDEX[w]] = 1;
    if (/ies$/.test(w)) out[w.replace(/ies$/, "y")] = 1;
    // studied / applied: -ied trả lại -y, nếu không họ động từ bị đứt chuỗi.
    if (/ied$/.test(w)) out[w.replace(/ied$/, "y")] = 1;
    ["es", "s", "ed", "ing"].forEach(function (suf) {
      if (w.length <= suf.length + 1 || w.slice(-suf.length) !== suf) return;
      var b = w.slice(0, -suf.length);
      out[b] = 1;
      out[b + "e"] = 1;
      if (/(.)\1$/.test(b)) out[b.slice(0, -1)] = 1;
      if (LEMMA_INDEX[b]) out[LEMMA_INDEX[b]] = 1;
    });
    return Object.keys(out);
  }
  function sameVerbFamily(options) {
    if (options.length < 3) return false;
    var sets = options.map(lemmaSet);
    if (sets.some(function (s) { return !s.length; })) return false;
    return sets.reduce(function (a, s) {
      return a.filter(function (x) { return s.indexOf(x) >= 0; });
    }, sets[0]).length > 0;
  }
  /* Đề có thể trộn 3 dạng cùng họ với một nhiễu khác họ (vd. go/went/going + chair).
     Đếm họ đông nhất và đánh dấu lựa chọn thuộc họ đó, để trò “Thì” vẫn dùng được
     câu 4 đáp án mà chỉ có 3 dạng cùng một động từ. */
  function familyLegend(options) {
    var sets = options.map(lemmaSet);
    var count = {};
    sets.forEach(function (s) {
      (s || []).forEach(function (x) { count[x] = (count[x] || 0) + 1; });
    });
    var best = 0, bestLemma = "";
    Object.keys(count).forEach(function (x) {
      if (count[x] > best || (count[x] === best && x.length < bestLemma.length)) {
        best = count[x];
        bestLemma = x;
      }
    });
    return {
      count: best,
      inFamily: sets.map(function (s) { return bestLemma ? s.indexOf(bestLemma) >= 0 : false; }),
    };
  }

  function verbForms(p, options) {
    var lead = words(p.pre).slice(-1)[0] || "";
    return options.map(function (o) {
      var f = verbForm(o);
      // Trợ động từ đã nằm sẵn trong đề ("will ______") -> dạng đúng là cả cụm.
      if (/^(will|would|shall)$/.test(lead) && f[0] === "base")
        return ["future", lead + " + " + f[1]];
      return f;
    });
  }
  function tenseHit(p) {
    var whole = norm(p.pre + " " + p.post);
    for (var i = 0; i < TENSE_CUES.length; i++)
      if (TENSE_CUES[i][0].test(whole))
        return [TENSE_CUES[i], (TENSE_CUES[i][0].exec(whole) || [""])[0].trim()];
    return null;
  }

  function tenseAnalysis(p, options, aIdx) {
    if (!sameVerbFamily(options)) return null;
    var forms = verbForms(p, options);
    var found = tenseHit(p);
    if (!found) return null;
    var hit = found[0];
    // Chỉ khẳng định khi dạng của ĐÁP ÁN ĐÚNG khớp dấu hiệu. V-ed vừa là quá khứ
    // đơn vừa là phân từ 2 nên hai trường hợp đó gộp được; "had + V3" mới là hoàn thành.
    var got = forms[aIdx][0];
    var ansWord = verbSlot(norm(options[aIdx]));
    var edAmbiguous = /ed$/.test(ansWord) ||
      (!!LEMMA_INDEX[ansWord] && IRREGULAR[LEMMA_INDEX[ansWord]] &&
        IRREGULAR[LEMMA_INDEX[ansWord]][0] === IRREGULAR[LEMMA_INDEX[ansWord]][1]);
    var hadForm = /^(had)\b/.test(norm(options[aIdx]));
    var ok = got === hit[2] ||
      (edAmbiguous && (hit[2] === "pp" || hit[2] === "past") && (got === "past" || got === "pp")) ||
      (hit[2] === "past-perfect" && (got === "pp" || got === "past-perfect") && hadForm) ||
      (hit[2] === "ing" && got === "past-ing") ||
      (hit[2] === "future" && got === "base");
    if (!ok) return null;
    return {
      kind: "tense",
      head: ["Dấu hiệu “" + found[1] + "” → câu ở " + hit[1] +
        " → " + LETTERS[aIdx] + ". " + options[aIdx] + " — " + forms[aIdx][1] + "."],
      options: options.map(function (o, k) {
        return LETTERS[k] + ". " + o + " — " + forms[k][1] +
          (k === aIdx ? " ✅" : forms[k][0] !== hit[2] ? " → không phải dạng của " + hit[1] : "");
      }),
      tense: hit[1],
    };
  }

  var RE_TIME = /\b(\d+ (?:years|months|weeks|days|hours) ago|on a (?:regular|daily|weekly|monthly) basis|every (?:day|week|month|year|morning|evening)|each (?:day|week|month|year)|right now|at the moment|at present|these days|now|currently|today|tomorrow|yesterday|last (?:week|month|year|night|quarter)|next (?:week|month|year)|recently|lately|so far|up to now|usually|often|always|normally|regularly|typically|generally|in (?:19|20)\d\d|already)\b/;

  /* Không nhận ra dấu hiệu thì (hoặc đáp án không khớp dấu hiệu): vẫn liệt kê đủ
     4 dạng động từ để người học thấy câu hỏi đang so sánh gì, nhưng KHÔNG khẳng
     định thì nào đúng — tránh dạy sai khi đề thiếu căn cứ. */
  function tenseFormsAnalysis(p, options, aIdx) {
    if (!sameVerbFamily(options)) return null;
    var forms = verbForms(p, options);
    var v = verbSlot(norm(options[aIdx]));
    // Gọi tên động từ bằng nguyên thể chung của 4 lựa chọn (drive chứ không phải
    // driving), nên lấy từ xuất hiện nhiều nhất trong các họ từ.
    var lemma = (function () {
      var count = {};
      options.forEach(function (o) {
        lemmaSet(o).forEach(function (x) { count[x] = (count[x] || 0) + 1; });
      });
      var best = "", n = 0;
      Object.keys(count).forEach(function (x) {
        if (count[x] > n || (count[x] === n && x.length < best.length)) { best = x; n = count[x]; }
      });
      return LEMMA_INDEX[best] || best || LEMMA_INDEX[v] || v;
    })();
    var head = ["Bốn lựa chọn là bốn dạng của động từ “" + lemma +
      "” → câu này kiểm tra THÌ / dạng động từ, không kiểm tra từ loại."];
    var tm = RE_TIME.exec(norm(p.pre + " " + p.post));
    if (tm) head.push("Cụm thời gian trong câu: “" + tm[0] + "” — chọn dạng động từ tương ứng với cụm đó.");
    else head.push("Hãy tìm cụm từ chỉ thời gian trong câu (yesterday, since 2019, every day, now …) rồi chọn dạng động từ.");
    var subj = words(p.pre);
    var hasPresent = forms.some(function (f) { return f[0] === "present"; });
    if (subj.length && subj.length <= 3 && hasPresent && !/s$/.test(subj[subj.length - 1]))
      head.push("Chủ ngữ “" + p.pre.trim() + "” ở số ít → nếu câu là hiện tại đơn, động từ phải thêm -s/-es.");
    return {
      kind: "tense",
      head: head,
      options: options.map(function (o, k) {
        return LETTERS[k] + ". " + o + " — " + forms[k][1] + (k === aIdx ? " ✅" : "");
      }),
      tense: null,
    };
  }

  /* ---------- 5b. Giới từ: cả 4 lựa chọn đều là giới từ ---------- */
  function isPrepWord(o) {
    var w = words(o)[0];
    return !!w && (FIXED[w] === "preposition" || EXTRA_PREP[w]);
  }
  function prepFallback(p, options, aIdx, glossary) {
    // Chỉ đúng khi MỖI lựa chọn là một giới từ đơn (from/in/to…). Câu đọc hiểu có
    // lựa chọn cả cụm ("In the cafeteria") không thuộc mạch này.
    if (!options.length ||
      !options.every(function (o) { return words(o).length === 1 && isPrepWord(o); }))
      return null;
    var postWords = words(p.post);
    var rest = postWords.join(" ");
    // Theo sau là một mệnh đề (chủ ngữ + động từ) => đây là câu hỏi LIÊN TỪ,
    // nói "giới từ" ở đây sẽ sai.
    if (/^(i|he|she|it|we|they|you|someone|everybody|there)\b/.test(rest) ||
      /^(was|were|has|have|had|is|are|did|would|will|can|should|they|it)\b/.test(rest))
      return null;
    var after = words(p.post)[0] || "";
    var before = lastWord(p.pre, false);
    var head = ["Cả " + options.length + " lựa chọn đều là giới từ → câu này kiểm tra CÁCH DÙNG của giới từ, không kiểm tra từ loại."];
    if (after)
      head.push("Đứng ngay sau chỗ trống là “" + after + "” — chọn giới từ đi được với từ đó.");
    else if (before)
      head.push("Đứng ngay trước chỗ trống là “" + before + "” — xét xem từ đó đòi giới từ nào.");
    return {
      kind: "prep",
      skipGloss: true,
      head: head,
      options: options.map(function (o, k) {
        var w = words(o)[0];
        var g = glossary && lookup(glossary, o);
        return LETTERS[k] + ". " + o + " — " + (PREP_VI[w] || (g ? g.vi : "giới từ")) +
          (PREP_USE[w] ? " · " + PREP_USE[w] : "") + (k === aIdx ? " ✅" : "");
      }),
    };
  }

  /* ---------- 5c. Đại từ bất định (everyone / anyone / …) ---------- */
  var INDEF = {
    everyone: "mọi người", everybody: "mọi người", everything: "mọi thứ",
    someone: "một ai đó", somebody: "một ai đó", something: "một thứ gì đó",
    anyone: "bất kỳ ai/người nào", anybody: "bất kỳ ai/người nào",
    anything: "bất kỳ điều gì", noone: "không ai", nobody: "không ai",
    nothing: "không gì cả",
  };
  function indefKey(o) {
    var w = norm(o).replace(/\s+/g, "");
    return INDEF[w] ? w : "";
  }
  function indefiniteAnalysis(p, options, aIdx) {
    if (!options.length) return null;
    var ks = options.map(indefKey);
    if (ks.some(function (k) { return !k; })) return null;
    var ans = ks[aIdx];
    var whole = norm(p.pre + " " + p.post);
    var neg = /\b(not|never|rarely|seldom|hardly|without|fail|deny|refuse|lack)\b/.test(whole);
    var ask = /\?/.test(String(p.post).slice(-2));
    var anyForm = /^an(y|thing|body)/.test(ans);
    var everyForm = /^every/.test(ans);
    var head = ["Bốn lựa chọn là đại từ bất định, khác nhau ở NGHĨA (mọi người / một người / bất kỳ người nào / không ai), không khác nhau về hình thức."];
    if (!words(p.pre).length) head.push("Chỗ trống đứng đầu câu → làm CHỦ NGỮ của động từ phía sau.");
    if (anyForm && (neg || ask))
      head.push("Câu " + (neg ? "có từ phủ định" : "là câu hỏi") + " → dạng “any-” là hợp lý → " +
        LETTERS[aIdx] + ". " + options[aIdx] + " (" + INDEF[ans] + ").");
    else if (everyForm && !neg && !ask)
      head.push("Câu khẳng định, không có từ phủ định → “" + options[aIdx] + " = " + INDEF[ans] + "” là đáp án " + LETTERS[aIdx] + ".");
    return {
      kind: "pronoun",
      head: head,
      options: options.map(function (o, k) {
        return LETTERS[k] + ". " + o + " — " + INDEF[indefKey(o)] +
          (/^(any)/.test(indefKey(o)) ? " (dùng trong câu phủ định/nghi vấn)" : "") +
          (k === aIdx ? " ✅" : "");
      }),
    };
  }

  /* ---------- 5e. Đại từ chỉ định & đại từ quan hệ mở rộng ---------- */
  var DEMOREL = {
    this: { vi: "cái này / người này (số ít)", num: "singular" },
    that: { vi: "cái đó / người đó (số ít); cũng là đại từ quan hệ", num: "singular" },
    these: { vi: "những cái này (số nhiều)", num: "plural" },
    those: { vi: "những cái đó (số nhiều)", num: "plural" },
    who: { vi: "người mà — làm CHỦ NGỮ mệnh đề quan hệ", role: "subject" },
    whom: { vi: "người mà — làm TÂN NGỮ (sau động từ/giới từ)", role: "object" },
    whose: { vi: "của ai/cái mà — sở hữu, đứng trước danh từ", role: "poss" },
    which: { vi: "cái mà — chỉ vật", role: "either" },
    what: { vi: "điều gì — không thay cho danh từ đã nhắc", role: "either" },
  };
  function demoRelAnalysis(p, options, aIdx) {
    var ks = options.map(function (o) { return words(o)[0]; });
    if (!ks.length || !DEMOREL[ks[aIdx]] || ks.some(function (k) { return !DEMOREL[k]; })) return null;
    if (isSentenceLike(options)) return null;
    var post = words(p.post);
    var fw = post[0] || "";
    var prepBefore = FIXED[lastWord(p.pre, false)] === "preposition" ? lastWord(p.pre, false) : "";
    var verbAfter = !prepBefore &&
      (/^(is|are|was|were|has|have|had|will|would|can|could|may|might|must|does|do|did)$/.test(fw) ||
        (!!fw && /ed$/.test(fw) && !/^(and|but|or|the|a|an|of|in|on|to)$/.test(fw)));
    var pluralVerb = /^(are|were|have|many|few|these|those)\b/.test(post.slice(0, 2).join(" "));
    var singularVerb = /^(is|was|has|does|this|that)\b/.test(post.slice(0, 2).join(" "));
    var ofAfter = /^of\b/.test(post.slice(0, 1).join(" "));
    var thanBefore = /\b(than|as)\s+$/.test(norm(p.pre) + " ");
    var ans = DEMOREL[ks[aIdx]];
    var isRel = ks.every(function (k) { return DEMOREL[k].role; });
    var head = [];
    if (isRel) {
      head.push("Bốn lựa chọn là đại từ quan hệ — khác nhau ở VAI TRÒ trong mệnh đề: " +
        ks.map(function (k, i) { return LETTERS[i] + ". " + options[i] + " = " + DEMOREL[k].vi; }).join(" · "));
      if (prepBefore && ans.role === "object") {
        head.push("Chỗ trống đứng ngay sau giới từ “" + prepBefore + "” → cần dạng TÂN NGỮ (“" +
          options[aIdx] + "”), không dùng dạng chủ ngữ.");
      } else if (verbAfter)
        head.push("Ngay sau chỗ trống là động từ “" + fw + "” → mệnh đề đang thiếu CHỦ NGỮ, nên dạng tân ngữ “whom” không dùng được.");
      else if (fw && ans.role === "poss")
        head.push("Ngay sau chỗ trống là danh từ “" + fw + "” → chỗ trống là đại từ sở hữu “whose”.");
    } else {
      head.push("Bốn lựa chọn là đại từ chỉ định, khác nhau ở SỐ và khoảng cách: " +
        ks.map(function (k, i) { return LETTERS[i] + ". " + options[i] + " = " + DEMOREL[k].vi; }).join(" · "));
      if (pluralVerb && ans.num === "plural")
        head.push("Động từ sau chỗ trống là “" + fw + "” (số nhiều) → cần đại từ số nhiều → " +
          LETTERS[aIdx] + ". " + options[aIdx] + ".");
      else if (singularVerb && ans.num === "singular")
        head.push("Động từ sau chỗ trống là “" + fw + "” (số ít) → cần đại từ số ít → " +
          LETTERS[aIdx] + ". " + options[aIdx] + ".");
      else if (thanBefore && ofAfter)
        head.push("So sánh “than/as + that of (thay cho danh từ số ít) / those of (danh từ số nhiều)” — xét danh từ đã nhắc phía trước.");
    }
    return {
      kind: "pronoun",
      skipGloss: true,
      head: head,
      options: options.map(function (o, i) {
        var m = DEMOREL[ks[i]];
        var line = LETTERS[i] + ". " + o + " — " + m.vi;
        if (i !== aIdx) {
          if (isRel && verbAfter && m.role === "object") line += " → loại (không làm chủ ngữ trước động từ)";
          else if (isRel && prepBefore && ans.role === "object" && m.role === "subject")
            line += " → loại (sau giới từ cần tân ngữ)";
          else if (!isRel && m.num && ans.num && m.num !== ans.num && (pluralVerb || singularVerb))
            line += " → loại (cần dạng " + (ans.num === "plural" ? "số nhiều" : "số ít") + ")";
        }
        return line + (i === aIdx ? " ✅" : "");
      }),
    };
  }

  /* Đuôi từ -> ghi chú an toàn (không khẳng định lớp từ, chỉ nói đuôi đó thường
     báo hiệu gì). Dùng cho câu không có chỗ trống trong đề. */
  var END_VI = {
    ation: "đuôi -ation (thường là danh từ)", ition: "đuôi -ition (danh từ)",
    tion: "đuôi -tion (danh từ)", sion: "đuôi -sion (danh từ)",
    ment: "đuôi -ment (danh từ)", ness: "đuôi -ness (danh từ)",
    ity: "đuôi -ity (danh từ)", ance: "đuôi -ance (danh từ)",
    ence: "đuôi -ence (danh từ)", ure: "đuôi -ure (danh từ)",
    dom: "đuôi -dom (danh từ)", hood: "đuôi -hood (danh từ)",
    ship: "đuôi -ship (danh từ)", ism: "đuôi -ism (danh từ)",
    age: "đuôi -age (danh từ)", ing: "đuôi -ing", ed: "đuôi -ed",
    ically: "đuôi -ically (trạng từ)", ly: "đuôi -ly (thường là trạng từ)",
    est: "đuôi -est (so sánh nhất)", er: "đuôi -er (so sánh hơn hoặc chỉ người)",
    able: "đuôi -able (tính từ)", ible: "đuôi -ible (tính từ)",
    ious: "đuôi -ious (tính từ)", ous: "đuôi -ous (tính từ)",
    ive: "đuôi -ive (tính từ/danh từ)", less: "đuôi -less (tính từ)",
    ful: "đuôi -ful (tính từ)", al: "đuôi -al (tính từ/danh từ)",
    ic: "đuôi -ic (tính từ)", ish: "đuôi -ish (tính từ)",
    ary: "đuôi -ary", ify: "đuôi -ify (động từ)",
    ize: "đuôi -ize (động từ)", ise: "đuôi -ise (động từ)",
    ate: "đuôi -ate (động từ)", y: "đuôi -y (tính từ)",
  };
  function suffixNote(word) {
    var w = words(word)[0];
    if (!w) return "";
    var best = "";
    Object.keys(END_VI).forEach(function (e) {
      if (w.length > e.length + 1 && w.slice(-e.length) === e && e.length > best.length) best = e;
    });
    return best ? END_VI[best] : "";
  }

  /* Đề không có chỗ trống (dạng “Chọn từ cho câu số 5”, câu hỏi đọc hiểu):
     chỉ phân tích được chính 4 lựa chọn — cùng họ từ hay không, lớp từ nào. */
  function optionsOnlyAnalysis(options, aIdx, glossary) {
    if (isSentenceLike(options)) return null;
    var root = commonRoot(options);
    var cls = options.map(function (o) { return classOf(o); });
    var known = cls.filter(Boolean).length;
    var hasGloss = options.some(function (o) { return lookup(glossary, o); });
    if (!root && !known && !hasGloss) return null;
    var notes = options.map(function (o) { return suffixNote(o); });
    var distinct = {};
    notes.concat(cls).forEach(function (x) { if (x) distinct[x] = 1; });
    var manyForms = Object.keys(distinct).length >= 2;
    var head = [];
    if (root && manyForms)
      head.push("Bốn lựa chọn đều cùng gốc “" + root + "” nhưng khác nhau ở phần đuôi — " +
        "dạng nào đúng tùy vào vị trí chỗ trống trong đoạn văn (bài đọc).");
    else if (known === options.length && cls.every(function (c) { return c === cls[0]; }))
      head.push("Cả " + options.length + " lựa chọn đều là " + POS_VI[cls[0]] +
        " → câu này kiểm tra NGHĨA của từ, không kiểm tra từ loại.");
    else if (hasGloss)
      head.push("Bốn lựa chọn là bốn từ khác nhau — xét nghĩa phù hợp với chỗ trống trong đoạn.");
    return {
      kind: root && manyForms ? "family" : "meaning",
      skipGloss: true,
      head: head,
      options: options.map(function (o, i) {
        var g = glossary && lookup(glossary, o);
        var bits = [];
        if (cls[i]) bits.push(POS_VI[cls[i]]);
        if (notes[i]) bits.push(notes[i]);
        if (g) bits.push("nghĩa: " + g.vi);
        return LETTERS[i] + ". " + o + " — " +
          (bits.length ? bits.join(" · ") : "không nhận ra theo đuôi") +
          (i === aIdx ? " ✅" : "");
      }),
      cue: "",
      tense: null,
    };
  }

  /* ---------- 5d. Nhãn lớp từ có đánh dấu đuôi mơ hồ (-al, -ent, -ive…) ---------- */
  function classLabel(word, root) {
    var c = classOf(word, root);
    if (!c) return "";
    var w = words(word)[0];
    var amb = ["al", "ant", "ent", "ive", "ing", "ed"].filter(function (e) {
      return w.length > e.length + 2 && w.slice(-e.length) === e;
    })[0];
    if (amb && (c === "adjective" || c === "noun" || c === "person"))
      return "danh từ/tính từ (đuôi -" + amb + ")";
    return POS_VI[c];
  }

  /* Câu hỏi kiểm tra NGHĨA từ vựng: không có luật ngữ pháp nào bật, nhưng vẫn nói
     được 4 lựa chọn thuộc nhóm gì, chỗ trống nằm giữa đâu, và nghĩa (nếu bộ đề
     có danh sách từ). */
  function slotPosition(p) {
    var pre = words(p.pre).slice(-2).join(" ");
    var post = words(p.post).slice(0, 2).join(" ");
    return "Chỗ trống đứng sau “" + (pre || "đầu câu") + "”" +
      (post ? " và trước “" + post + "”" : " và kết thúc câu") + ".";
  }
  function meaningAnalysis(p, options, aIdx, glossary) {
    if (isSentenceLike(options)) return null;
    var cls = options.map(function (o) { return classOf(o); });
    var known = cls.filter(Boolean).length;
    var hasGloss = !!(glossary && options.some(function (o) { return lookup(glossary, o); }));
    if (!known && !hasGloss) return null;
    var uniq = {};
    cls.forEach(function (c) { if (c) uniq[c] = 1; });
    var sameCls = Object.keys(uniq).length === 1 && known === options.length;
    var head = [];
    if (sameCls)
      head.push("Cả " + options.length + " lựa chọn đều là " + POS_VI[cls[0]] +
        " → câu này KHÔNG kiểm tra từ loại; chọn theo NGHĨA phù hợp với ngữ cảnh.");
    else
      head.push("Các lựa chọn thuộc các nhóm từ khác nhau → phải xét cả vị trí chỗ trống lẫn nghĩa của từng từ (xem từng dòng dưới).");
    head.push(slotPosition(p));
    return {
      kind: "meaning",
      head: head,
      options: options.map(function (o, i) {
        var g = glossary && lookup(glossary, o);
        var lab = classLabel(o, "");
        return LETTERS[i] + ". " + o + " — " + (lab || "nhóm từ không nhận ra theo đuôi") +
          (g ? ", nghĩa: " + g.vi : "") + (i === aIdx ? " ✅" : "");
      }),
    };
  }

  /* Câu không có chỗ trống (dạng “từ nào nghĩa là X?”): dựng bảng nghĩa từ
     danh sách từ vựng của bộ đề đã lưu trong payload.g. */
  function noBlankAnalysis(stem, options, aIdx, glossary) {
    var known = options.map(function (o) { return lookup(glossary, o); });
    if (!known.filter(Boolean).length) return null;
    var quoted = (stem.match(/[“"'’]([^“”"'’]{2,48})[”"'’]/) || [])[1] || "";
    var head = [];
    var ansG = known[aIdx];
    if (quoted && ansG && norm(ansG.vi).indexOf(norm(quoted)) >= 0)
      head.push("Đề bài hỏi nghĩa của “" + quoted + "” → tra danh sách từ của bộ đề: “" +
        ansG.term + "” = " + ansG.vi + " ✅.");
    else
      head.push("Câu này hỏi NGHĨA của từ (không có chỗ trống ngữ pháp). Nghĩa lấy từ danh sách từ vựng của chính bộ đề.");
    return {
      kind: "meaning",
      head: head,
      options: options.map(function (o, i) {
        return LETTERS[i] + ". " + o + (known[i] ? " = " + known[i].vi : " — không có trong danh sách từ") +
          (i === aIdx ? " ✅" : "");
      }),
      cue: "",
      tense: null,
    };
  }

  /* ---------- 6. Danh sách từ vựng của bộ đề (0 token) ---------- */
  var RE_GLOSS_POS = /\(\s*(n|v|adj|adv|prep|pron|conj|phr\.?\s*v\.?)\b[^)]*\)/i;
  var RE_GLOSS_HEAD = /^(unit|bài|part|phase|section|phần|dạng|câu|note|ghi chú)\b[:.\s]*\d*\s*$/i;
  function harvestGlossary(text) {
    var map = Object.create(null);
    String(text || "").replace(/：/g, ":").split(/\r?\n/).forEach(function (raw) {
      var line = raw.trim();
      if (!line || line.indexOf(":") < 2) return;
      if (/_{3,}/.test(line) || /\?\s*$/.test(line)) return;
      if (/^[A-Da-d][.)]/.test(line) || /^\s*(?:\d+\.|Câu\s*\d+)/i.test(line)) return;
      var cut = line.lastIndexOf(":");
      var left = line.slice(0, cut).trim();
      var vi = line.slice(cut + 1).trim().replace(/\s+/g, " ");
      if (!vi || vi.length > 90 || !/[a-zà-ỹ]/i.test(vi)) return;
      if (left.length > 90 || (left.match(/:/g) || []).length) return;
      var ipa = (left.match(/\/[^/]{2,60}\//) || [])[0] || "";
      var pos = (RE_GLOSS_POS.exec(left) || [])[1] || "";
      var term = left.replace(/\([^)]*\)/g, " ").replace(RE_GLOSS_POS, " ")
        .replace(/\/[^/]*\//g, " ")
        .replace(/\s+/g, " ").replace(/[.,;:\[\]()]/g, " ")
        .replace(/\s(n|v|adj|adv|prep|pron|conj|phr|vi|en)\.?$/i, "").trim();
      if (!term || term.length > 46 || RE_GLOSS_HEAD.test(term)) return;
      if (!/[a-zA-Z]{3}/.test(term)) return;
      var k = norm(term);
      if (k && !map[k])
        map[k] = { term: term, vi: vi, pos: pos, ipa: ipa };
    });
    return map;
  }
  function lookup(glossary, word) {
    if (!glossary) return null;
    var w = norm(word);
    if (!w) return null;
    if (glossary[w]) return glossary[w];
    var ws = w.split(" ");
    for (var i = ws.length - 1; i >= 0; i--) if (glossary[ws[i]]) return glossary[ws[i]];
    var stems = [w.replace(/s$/, ""), w.replace(/ied$/, "y"), w.replace(/(ing|ed)$/, ""),
      w.replace(/(ing|ed)$/, "") + "e", w.replace(/es$/, "")];
    for (var j = 0; j < stems.length; j++)
      if (stems[j] && glossary[stems[j]]) return glossary[stems[j]];
    return null;
  }

  /* Phần tra được từ danh sách từ của bộ đề, lưu kèm câu hỏi (payload.g) để
     trình duyệt tái hiện được giải thích mà không cần văn bản gốc của file. */
  function hintsFor(question, glossary) {
    var q = question || {}, options = q.o || [];
    if (!glossary || !options.length) return null;
    var o = options.map(function (w) {
      var g = lookup(glossary, w);
      return g ? { t: g.term, v: g.vi } : null;
    });
    var stem = norm(String(q.q || "").replace(/_{2,}/g, " "));
    var STOP = { the: 1, a: 1, an: 1, of: 1, to: 1, in: 1, on: 1, at: 1, for: 1,
      and: 1, or: 1, with: 1, do: 1, does: 1, is: 1, are: 1, be: 1, by: 1 };
    var p = [];
    Object.keys(glossary).forEach(function (k) {
      if (p.length >= 8 || k.indexOf(" ") < 0) return;
      var shared = words(k).some(function (w) {
        return !STOP[w] && w.length > 3 &&
          new RegExp("\\b" + escapeRe(w) + "\\b").test(stem);
      });
      if (shared) p.push({ t: glossary[k].term, v: glossary[k].vi });
    });
    if (!o.filter(Boolean).length && !p.length) return null;
    return { o: o, p: p };
  }
  // q.g (đã lưu trong CSDL) được nạp thành bản tra nhỏ dùng như glossary.
  function mergedGlossary(question, glossary) {
    var g = glossary || Object.create(null);
    var hints = question && question.g;
    if (!hints) return g;
    var out = Object.create(null);
    Object.keys(g).forEach(function (k) { out[k] = g[k]; });
    [].concat(hints.o || [], hints.p || []).forEach(function (e) {
      if (!e || !e.t) return;
      var k = norm(e.t);
      if (k && !out[k]) out[k] = { term: e.t, vi: e.v, pos: "", ipa: "" };
    });
    return out;
  }

  /* ---------- 7. Sinh giải thích cho một câu ---------- */
  function analyze(question, glossary) {
    var q = question || {};
    var stem = String(q.q || ""), options = q.o || [], aIdx = q.a;
    var empty = { kind: "none", head: [], options: [], cue: "" };
    if (!stem || !options.length || aIdx == null || aIdx < 0) return empty;
    glossary = mergedGlossary(q, glossary);
    var p = parts(stem);
    if (!p) {
      var nb = noBlankAnalysis(stem, options, aIdx, glossary);
      if (!nb && !isSentenceLike(options)) nb = optionsOnlyAnalysis(options, aIdx, glossary);
      if (!nb) return empty;
      return { kind: nb.kind, head: nb.head, options: nb.options, cue: "", tense: null };
    }
    var ansClass = classOf(options[aIdx], "", true);
    var res = null;

    if (options.length >= 3) res = tenseAnalysis(p, options, aIdx);
    if (!res && /^[\w\s]{1,26}$/.test(norm(options[aIdx]))) res = prepAnalysis(p, options, aIdx, glossary);
    if (!res) res = demoRelAnalysis(p, options, aIdx);
    if (!res) res = pronounAnalysis(p, options, aIdx);

    var root = isFamily(options);
    var need = null;
    var guess = slotNeed(p, ansClass, options[aIdx]);
    var confirmed = false;
    var ansWord0 = words(options[aIdx])[0] || "";
    if (guess && (guess.need === ansClass ||
      (guess.need === "noun" && ansClass === "person") ||
      // "was appointed by": V-ed vừa là phân từ vừa bị đuôi tính từ nhận ra, nên
      // đáp án mang nhãn "tính từ" vẫn khớp chỗ trống bị động.
      (guess.passive && ansClass === "adjective" && /ed$/.test(ansWord0)))) { need = guess; confirmed = true; }
    // Đáp án không có đuôi nhận dạng được (contract, overall…) nhưng đuôi đó
    // cũng không phủ định vị trí: vẫn nói rõ chỗ trống cần gì, chỉ không khẳng
    // định "vì vậy đáp án là X". Chỉ dùng khi cả 4 lựa chọn đều vô dạng, vì nếu
    // đã phân loại được vài lựa chọn mà đáp án lại lệch thì luật ở đây không tin cậy.
    else if (guess && !ansClass && !canRuleOut(options[aIdx], guess.need) &&
      !options.some(function (o) { return classOf(o, root, false); })) need = guess;

    if (!res && (root || need) && !(need === null && sameVerbFamily(options))) {
      // Khi chỗ trống chắc chắn cần động từ nguyên thể thì cho phép nhận dạng
      // động từ không có đuôi (hire, buy, rent…) để dán nhãn đủ 4 lựa chọn.
      var bare = !!(need && need.need === "verb");
      var cls = options.map(function (o) { return classOf(o, root, bare); });
      var same = cls.every(function (c) { return c && c === cls[0]; });
      // Chỉ loại một lựa chọn khi lớp của nó (theo rễ chung hoặc theo đuôi) chắc
      // chắn không khớp vị trí chỗ trống.
      var ruledOut = function (i) {
        if (!need || same) return false;
        // Ở chỗ trống bị động thì V-ed / V-ing đều là dạng động từ, đừng loại
        // nhau bằng nhãn tính từ mà đuôi từ gợi ra.
        if (need.passive && /(ed|ing)$/.test(words(options[i])[0] || "")) return false;
        // Chỉ loại khi chính bộ phân loại nói được lớp của lựa chọn đó; nhãn
        // "chưa xác định được lớp từ" mà kèm "→ loại" thì thành tự mâu thuẫn.
        return cls[i] ? cls[i] !== need.need &&
          !(need.need === "noun" && cls[i] === "person") : false;
      };
      var anyRuled = cls.some(function (c, i) { return i !== aIdx && ruledOut(i); });
      // Luật từ loại chỉ được phép kết luận đáp án khi nó loại được HẾT lựa chọn
      // còn lại; nếu vẫn còn hai ba từ cùng đúng lớp thì câu đó hỏi NGHĨA.
      var allRuled = cls.every(function (c, i) { return i === aIdx || ruledOut(i); });
      var head = [];
      if (need && !same)
        head.push("Vị trí “" + need.cue.trim() + "”: " + need.why +
          (!confirmed ? "." : allRuled
            ? " → đáp án " + LETTERS[aIdx] + ". " + options[aIdx] + "."
            : anyRuled
              ? " → nhưng chưa loại được hết các lựa chọn khác chỉ bằng từ loại, phải chọn thêm theo NGHĨA."
              : " → nhưng riêng vị trí này chưa phân biệt được 4 lựa chọn, phải chọn theo NGHĨA."));
      else if (need && same)
        head.push("Cả 4 lựa chọn đều là " + POS_VI[cls[0]] + " (" + need.cue.trim() +
          ": " + need.why + ") → câu này kiểm tra NGHĨA của từ, không kiểm tra từ loại.");
      res = {
        kind: root ? "family" : "slot",
        head: head,
        options: options.map(function (o, i) {
          var c = cls[i];
          var g = lookup(glossary, o);
          var blind = cls.every(function (x) { return !x; });
          var line = LETTERS[i] + ". " + o +
            (blind ? "" : " — " + (c ? POS_VI[c] : "chưa xác định được lớp từ"));
          if (g) line += (blind ? " — " : ", ") + "nghĩa: " + g.vi;
          if (i === aIdx) line += " ✅";
          else if (ruledOut(i)) line += " → loại (cần " + POS_VI[need.need] + ")";
          return line;
        }),
      };
    }

    // Không có luật nào khớp: lần lượt thử các dạng “kiểm tra gì” còn lại.
    if (!res) res = tenseFormsAnalysis(p, options, aIdx);
    if (!res) res = indefiniteAnalysis(p, options, aIdx);
    if (!res) res = prepFallback(p, options, aIdx, glossary);

    // Từ vựng: tra nghĩa trong chính danh sách từ của bộ đề.
    if (!res) {
      var known = options.map(function (o) { return lookup(glossary, o); });
      var found = known.filter(Boolean).length;
      if (found) {
        var lines = [];
        if (known[aIdx])
          lines.push("Theo danh sách từ vựng của bộ đề: “" + known[aIdx].term + "” = " +
            known[aIdx].vi + (known[aIdx].pos ? " (" + known[aIdx].pos + ")" : "") + ".");
        lines.push(slotPosition(p));
        res = {
          kind: "vocab",
          head: lines,
          skipGloss: true,
          options: options.map(function (o, i) {
            return LETTERS[i] + ". " + o +
              (known[i] ? " = " + known[i].vi : " — không có trong danh sách từ") +
              (i === aIdx ? " ✅" : "");
          }),
        };
      } else {
        res = meaningAnalysis(p, options, aIdx, glossary);
        if (!res) return empty;
      }
    }

    // Ghép nghĩa tiếng Việt vào các dòng lựa chọn còn thiếu.
    if (!res.skipGloss)
      res.options = res.options.map(function (line, i) {
        if (line.indexOf("=") >= 0 || line.indexOf("nghĩa:") >= 0) return line;
        var g = lookup(glossary, options[i]);
        return g && norm(line).indexOf(norm(g.vi)) < 0 ? line + ", nghĩa: " + g.vi : line;
      });
    return {
      kind: res.kind, head: res.head || [], options: res.options || [],
      cue: p ? cueOf(p) : "", tense: res.tense || null,
    };
  }

  /* ---------- 8. Sự kiện có cấu trúc cho trò "Phân loại nhanh" ----------
     analyze() trả chữ để hiển thị; hàm này trả ĐÚNG các giá luật suy ra được để
     giao diện tự so sánh với đáp án đã lưu. Không khẳng định gì thêm: chỗ nào luật
     im lặng thì trường đó null, và nơi dùng vẫn phải kiểm "luật khớp đáp án". */
  function facts(question) {
    var q = question || {};
    var stem = String(q.q || ""), options = q.o || [], aIdx = q.a;
    var out = {
      blank: null, cue: "", blankNeeds: null, optionClasses: [], answerClass: null,
      familyRoot: "", verbFamily: false, verbFamilyCount: 0, optionFamily: [],
      optionForms: [], optionFormWhys: [],
      answerForm: "", tenseSignal: "", tenseCode: "", tenseVi: "",
    };
    if (!stem || options.length < 2 || aIdx == null || aIdx < 0 || aIdx >= options.length)
      return out;
    var p = parts(stem);
    if (!p) return out;
    out.blank = p;
    out.cue = cueOf(p);
    var root = isFamily(options);
    var ansClass = classOf(options[aIdx], root, true);
    var need = slotNeed(p, ansClass, options[aIdx]);
    var forms = verbForms(p, options);
    var hit = tenseHit(p);
    out.familyRoot = root;
    out.answerClass = ansClass;
    out.optionClasses = options.map(function (o) {
      return classOf(o, root, false);
    });
    out.verbFamily = sameVerbFamily(options);
    var fam = familyLegend(options);
    out.verbFamilyCount = fam.count;
    out.optionFamily = fam.inFamily;
    out.optionForms = forms.map(function (f) { return f[0]; });
    out.optionFormWhys = forms.map(function (f) { return f[1]; });
    out.answerForm = forms[aIdx] ? forms[aIdx][0] : "";
    if (need) out.blankNeeds = { need: need.need, why: need.why, passive: !!need.passive };
    if (hit) {
      out.tenseSignal = hit[1];
      out.tenseCode = hit[0][2];
      out.tenseVi = hit[0][1];
    }
    return out;
  }

  return {
    analyze: analyze,
    facts: facts,
    harvestGlossary: harvestGlossary,
    hintsFor: hintsFor,
    lookup: lookup,
    classOf: classOf,
    isFamily: isFamily,
    slotNeed: slotNeed,
    parts: parts,
    verbForm: verbForm,
    sameVerbFamily: sameVerbFamily,
    optionMeaning: optionMeaning,
    POS_VI: POS_VI,
  };
});
