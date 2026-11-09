/* Bộ phân tích đề TOEIC: dùng chung cho trình duyệt và Node.js.
   Định dạng đầu vào: văn bản thuần (đã tách từ .docx, .md hoặc .txt). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ToeicParser = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var LETTERS = ["A", "B", "C", "D"];

  // Băm FNV-1a thành id ngắn, ổn định theo nội dung câu + đáp án.
  function hashId(text) {
    var h = 0x811c9dc5;
    for (var i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(36);
  }

  function normalizeSpace(s) {
    return String(s || "").replace(/\s+/g, " ").trim();
  }

  var TOPIC_RULES = [
    { keys: ["THÌ", "TENSE"], name: "Thì" },
    { keys: ["TỪ LOẠI", "PART OF SPEECH", "PARTS OF SPEECH"], name: "Từ loại" },
    { keys: ["GIỚI TỪ", "PREPOSITION"], name: "Giới từ" },
    { keys: ["ĐẠI TỪ", "PRONOUN"], name: "Đại từ" },
    { keys: ["TỪ VỰNG", "VOCABULARY", "VOCAB"], name: "Từ vựng" }
  ];

  function normalizeTopic(title) {
    var upper = normalizeSpace(title).toUpperCase();
    for (var i = 0; i < TOPIC_RULES.length; i++) {
      for (var j = 0; j < TOPIC_RULES[i].keys.length; j++) {
        if (upper.indexOf(TOPIC_RULES[i].keys[j]) !== -1) return TOPIC_RULES[i].name;
      }
    }
    // Giữ tiêu đề khác làm chủ điểm mới, bỏ phần mô tả số câu trong ngoặc.
    return normalizeSpace(title).replace(/\s*[-–:]?\s*\((\d+\s*(CÂU|QUESTIONS)?)[^)]*\)\s*$/i, "").replace(/\s*\(\d+\s*CÂU\)\s*/i, "").replace(/\s*\(\s*questions?\s*\d+\s*[-–]\s*\d+\s*\)\s*$/i, "").slice(0, 60);
  }

  var RE_SECTION = /^(PHẦN|PART|SECTION)\b/i;
  var RE_ANSWER_TITLE = /^(ĐÁP\s*ÁN|DAP\s*AN|ANSWER\s*KEY)/i;   // chấp cả file gõ không dấu
  // "1." / "12)" và cả kiểu đánh số có chữ: "Câu 1:", "Câu 12.", "Question 3:"
  var RE_QUESTION = /^(?:(\d{1,4})\s*[.)]\s*|(?:CÂU|Câu|QUESTION|Question|Q)\s*(\d{1,4})\s*[:.)\-–]\s*)(.*)$/;
  var RE_INLINE_OPTION = /[({]\s*([A-D])\s*[)}]\s*([^({]*)/g;
  var RE_LEAD_OPTION = /^([A-D])\s*[.)]\s*(.+)$/;
  var RE_ANSWER_LINE = /^(Đáp\s*án|Answer)\s*[:\-]?\s*\(?([A-D])\)?/i;
  // "Đáp án: B" là đáp án của chính câu phía trên, không phải tiêu đề bảng đáp án.
  var RE_ANSWER_EACH = /^(Đáp\s*án|Answer)\s*[:\-]\s*\(?([A-D])\)?\s*$/i;

  // Tiêu đề bảng đáp án: "ĐÁP ÁN", "ĐÁP ÁN CHI TIẾT (ANSWER KEY)", "ĐÁP ÁN: 1. (B)..."
  // Không nhầm với "Đáp án: B" của từng câu hay "Đáp án mẫu: <câu văn>".
  function isKeyHeading(line) {
    var t = normalizeSpace(line);
    if (!RE_ANSWER_TITLE.test(t) || /^[A-D]\s*[.)]/.test(t) || RE_ANSWER_EACH.test(t)) return false;
    var sep = t.search(/[:\-–]/);
    if (sep < 0) return true;
    var after = t.slice(sep + 1).trim();
    return /^\d{1,3}\s*[.)]/.test(after) || /^ANSWER\s*KEY/i.test(after);
  }
  var RE_TRAILING_LETTER = /\s\(?([A-D])\)?\s*[.·]?\s*$/;
  // Đề bài chỉ là chỗ dẫn tới đoạn văn: "Blank (1)", "Option for space (26):"
  var RE_PLACEHOLDER_STEM = /^(?:blank|option\s+for\s+space|chỗ\s+trống)\s*[(\s:]*(\d{1,3})\s*\)?:?$/i;

  // "Read the following passage…", "Read the passage below…", "Đọc đoạn văn…"
  // -> các dòng kế tiếp là đoạn văn dùng chung cho nhóm câu hỏi.
  var RE_PASSAGE_HINT = /^(read the (following |passage|text)|đọc (đoạn văn|bài khóa|đoạn))/i;
  var RE_PASSAGE_SKIP = /^(mark the letter|choose the (word|best|correct|option|sentence)|indicate the|chọn (từ|đáp án|câu|phương án)|hãy chọn)/i;

  // Dòng đánh dấu bảng do bộ đọc .docx chèn vào ("[BẢNG 2 CỘT]") — không phải nội dung đề.
  var RE_TABLE_MARK = /^\[BẢNG\s+2\s+CỘT\]$/i;

  // Bảng 2 cột được ghi thành "ô trái | ô phải" -> bỏ dấu "|" dính ở hai đầu giá trị.
  function stripPipes(s) {
    return normalizeSpace(s).replace(/^\|+\s*|\s*\|+$/g, "").trim();
  }

  function joinPassage(lines) {
    return lines.map(normalizeSpace).filter(Boolean).join("\n\n");
  }

  // Word hay dính liền chỉ dẫn với đoạn văn: "…each numbered space.Cybersecurity has become…".
  // Trả về phần nội dung đoạn văn nằm sau câu chỉ dẫn trên cùng một dòng.
  function passageRemainder(line) {
    var rest = String(line || "").replace(RE_PASSAGE_HINT, "");
    var head = rest.slice(0, 200);
    var cut = head.search(/[.:]\s*(?=[A-Z0-9“"'(])/);
    var content = (cut >= 0 && cut < 160 ? rest.slice(cut + 1) : rest).trim();
    if (!content) return "";
    // "text and choose the correct word for each numbered space." chỉ là câu chỉ dẫn,
    // đoạn văn thật nằm ở đoạn kế tiếp của file.
    if (cut < 0 && content.length < 80 && !/\(\s*\d+\s*\)/.test(content)) return "";
    return content;
  }

  // Câu chứa chỗ trống "(31)" trong đoạn văn -> dùng làm đề bài thay cho "Blank (31)".
  function stemFromPassage(passage, num) {
    var marker = new RegExp("\\(\\s*" + num + "\\s*\\)");
    var m = marker.exec(passage);
    if (!m) return null;
    var before = passage.slice(0, m.index);
    var cut = Math.max(
      before.lastIndexOf(". "),
      before.lastIndexOf("? "),
      before.lastIndexOf("! "),
      before.lastIndexOf("\n")
    );
    var from = cut < 0 ? 0 : cut + 1;
    var tailStart = m.index + m[0].length;
    var stop = passage.slice(tailStart).search(/[.!?](\s|$)/);
    var to = stop < 0 ? passage.length : tailStart + stop + 1;
    var sent = passage
      .slice(from, to)
      .replace(/\s+/g, " ")
      .replace(/\(\s*\d{1,3}\s*\)\s*/g, "")
      .replace(/_{2,}/g, "________")
      .trim();
    return sent || null;
  }

  // Tách một dòng chứa nhiều đáp án dính nhau: "(A) x(B) y(C) z(D) w"
  // allowLongPrefix: cho phép đáp án nằm ngay sau nội dung câu hỏi ("... at 8:00 AM.(A) go(B) goes...").
  function splitInlineOptions(line, allowLongPrefix) {
    var found = {};
    var matches = [];
    var re = /[({]\s*[A-D]\s*[)}]/g;
    var m;
    while ((m = re.exec(line))) matches.push({ index: m.index, letter: line.slice(m.index + 1, m.index + 2).trim(), start: re.lastIndex });
    if (!matches.length) return null;
    var first = line.slice(0, matches[0].index).trim();
    var letters = matches.map(function (x) { return x.letter; });
    var distinct = letters.filter(function (x, k) { return letters.indexOf(x) === k; });
    if (!allowLongPrefix) {
      if (first.length > 2) return null; // dòng có nội dung dài đứng trước -> không phải dòng đáp án
    } else if (distinct.length < 2 || letters[0] !== "A" || !first) {
      return null; // chỉ coi là đáp án khi bắt đầu bằng (A) và có từ hai nhãn khác nhau
    }
    for (var i = 0; i < matches.length; i++) {
      var end = i + 1 < matches.length ? matches[i + 1].index : line.length;
      var value = normalizeSpace(line.slice(matches[i].start, end)).replace(/[·•]\s*$/, "");
      if (value) found[matches[i].letter] = value;
    }
    return { stem: first, options: found };
  }

  // Tách dòng chứa HAI đáp án kiểu "A. delete      B. retrieve" (hoặc "C. compile   D. encrypt").
  // Chỉ nhận khi dòng bắt đầu bằng nhãn và các nhãn đi liền bậc (A→B, C→D),
  // nên câu văn có "B." ở giữa không bị cắt nhầm.
  function splitLetterOptions(line) {
    var t = normalizeSpace(line);
    var marks = [];
    var re = /(^|\s)([A-D])\s*[.)]\s+/g;
    var m;
    while ((m = re.exec(t))) marks.push({ letter: m[2], start: m.index + m[1].length, body: re.lastIndex });
    if (marks.length < 2) return null;
    if (marks[0].start !== 0) return null;
    for (var k = 1; k < marks.length; k++) {
      if (marks[k].letter.charCodeAt(0) !== marks[k - 1].letter.charCodeAt(0) + 1) return null;
    }
    var found = {};
    for (var i = 0; i < marks.length; i++) {
      var end = i + 1 < marks.length ? marks[i + 1].start : t.length;
      var value = normalizeSpace(t.slice(marks[i].body, end));
      if (value) found[marks[i].letter] = value;
    }
    return found;
  }

  function parseKey(text) {
    var map = {};
    var re = /(\d{1,4})\s*[.)]\s*\(?([A-D])\)?(?![\p{L}])/gu;
    var m;
    while ((m = re.exec(text))) {
      var num = parseInt(m[1], 10);
      if (!(num in map)) map[num] = m[2];
    }
    // Bảng đáp án dạng cột (mỗi ô một dòng): "1" / "A" / "giải thích…"
    var lines = String(text || "").split(/\r?\n/).map(normalizeSpace).filter(Boolean);
    for (var i = 0; i + 1 < lines.length; i++) {
      var mn = /^(\d{1,4})\s*[.)]?$/.exec(lines[i]);
      if (!mn) continue;
      var ml = /^\(?([A-D])\)?[.)]?$/.exec(lines[i + 1]);
      if (!ml) continue;
      var n = parseInt(mn[1], 10);
      if (!(n in map)) map[n] = ml[1];
    }
    return map;
  }

  function makeQuestion(topic, num, text, options, answerIndex, note, source, file, passage) {
    var stem = stripPipes(text);
    var opts = LETTERS.map(function (l) { return stripPipes(options[l] || ""); });
    var key = normalizeSpace(stem).toLowerCase() + "|" + opts.map(function (s) { return s.toLowerCase(); }).join("|");
    return {
      id: hashId(key),
      t: topic,
      n: stripPipes(normalizeSpace(note)),
      num: num,
      s: source || "import",
      f: file || null,
      q: normalizeSpace(stem),
      o: opts,
      a: answerIndex,
      passage: passage || null
    };
  }

  // Phân tích văn bản -> { questions, topics, problems, stats }
  function parse(text, options) {
    var opts = options || {};
    var source = opts.source || "import";
    var file = opts.file || null;
    var lines = String(text || "").split(/\r?\n/);

    var questions = [];
    var problems = [];
    var topics = [];
    var topic = normalizeSpace(opts.topic) || "Chưa phân loại";
    if (topics.indexOf(topic) === -1) topics.push(topic);

    var keyIndex = -1;
    for (var k = 0; k < lines.length; k++) {
      if (isKeyHeading(lines[k])) { keyIndex = k; break; }
    }
    var keyMap = keyIndex >= 0 ? parseKey(lines.slice(keyIndex).join("\n")) : {};
    var current = null;
    var pendingPassage = [];   // dòng văn bản chờ gắn cho nhóm câu hỏi kế tiếp
    var wantPassage = false;   // vừa gặp dòng "Read the passage…"
    var blockPassage = null;   // đoạn văn dùng chung cho các câu của phần hiện tại

    function flush() {
      if (!current) return;
      var q = current;
      current = null;
      var missing = LETTERS.filter(function (l) { return !q.options[l]; });
      if (missing.length) {
        problems.push({ num: q.num, reason: "Thiếu đáp án " + missing.join(", ") });
        return;
      }
      var answerLetter = null;
      var note = q.noteLines.join(" ");
      var keyLetter = keyMap[q.num] || null;
      if (keyLetter) answerLetter = keyLetter;
      else if (q.inlineLetter) answerLetter = q.inlineLetter;
      else if (q.hintLetter) answerLetter = q.hintLetter;
      if (!answerLetter) {
        var inline = q.noteLines.concat([q.text]).filter(function (s) { return RE_ANSWER_LINE.test(s); })[0];
        if (inline) answerLetter = RE_ANSWER_LINE.exec(inline)[2];
      }
      if (!answerLetter) {
        problems.push({ num: q.num, reason: "Không tìm thấy đáp án đúng" });
        return;
      }
      var idx = LETTERS.indexOf(answerLetter);
      if (keyLetter && q.hintLetter && keyLetter !== q.hintLetter) {
        problems.push({ num: q.num, reason: "Chữ cái cuối câu (" + q.hintLetter + ") khác bảng đáp án (" + keyLetter + "), dùng bảng đáp án" });
      }
      questions.push(makeQuestion(q.topic, q.num, q.text, q.options, idx, note, source, file, q.passage));
    }

    for (var i = 0; i < lines.length; i++) {
      var line = normalizeSpace(lines[i]);
      if (!line) continue;
      if (RE_TABLE_MARK.test(line)) continue;

      if (keyIndex >= 0 && i >= keyIndex) break;

      if (RE_SECTION.test(line)) {
        flush();
        pendingPassage = [];
        wantPassage = false;
        blockPassage = null;
        var name = normalizeTopic(line.replace(RE_SECTION, "").replace(/^[\s\d:.,-]+/, "").replace(/:$/, ""));
        topic = name || topic;
        if (topics.indexOf(topic) === -1) topics.push(topic);
        continue;
      }

      if (RE_PASSAGE_HINT.test(line)) {
        flush();
        var firstLine = passageRemainder(line);
        pendingPassage = firstLine ? [firstLine] : [];
        wantPassage = true;
        blockPassage = null;
        continue;
      }

      var mQ = RE_QUESTION.exec(line);
      // Dòng "1. (D) is reviewing" nằm trong bảng đáp án đã được xử lý riêng nên ở đây luôn là câu hỏi.
      if (mQ) {
        flush();
        if (wantPassage) {
          var pas = joinPassage(pendingPassage);
          blockPassage = pas.length >= 120 ? pas : null;
          wantPassage = false;
          pendingPassage = [];
        }
        var text = mQ[3];
        var mBlank = RE_PLACEHOLDER_STEM.exec(text);
        if (mBlank && blockPassage) {
          var fromPassage = stemFromPassage(blockPassage, mBlank[1]);
          if (fromPassage) text = fromPassage;
        }
        var gluedOpts = null;
        var glued = splitInlineOptions(text, true);
        if (glued) { text = glued.stem; gluedOpts = glued.options; }
        var mHint = RE_TRAILING_LETTER.exec(text);
        var hint = null;
        if (mHint) {
          hint = mHint[1];
          text = text.slice(0, mHint.index).trim();
        }
        current = { num: parseInt(mQ[1] || mQ[2], 10), topic: topic, text: text, hintLetter: hint, keyLetter: null, inlineLetter: null, options: gluedOpts || {}, noteLines: [], passage: blockPassage };
        continue;
      }

      if (wantPassage) {
        if (!RE_PASSAGE_SKIP.test(line)) pendingPassage.push(line);
        continue;
      }

      if (!current) {
        // Dòng mô tả trước câu hỏi đầu tiên -> bỏ qua.
        continue;
      }

      var split = splitInlineOptions(line, false);
      var picked = false;
      if (split) {
        LETTERS.forEach(function (l) { if (split.options[l] && !current.options[l]) { current.options[l] = split.options[l]; picked = true; } });
      }
      if (!picked) {
        var multi = splitLetterOptions(line);
        if (multi) {
          LETTERS.forEach(function (l) {
            if (multi[l] && !current.options[l]) { current.options[l] = multi[l]; picked = true; }
          });
        }
      }
      if (!picked) {
        var mLead = RE_LEAD_OPTION.exec(line);
        if (mLead) {
          var l = mLead[1];
          if (!current.options[l]) { current.options[l] = normalizeSpace(mLead[2]); picked = true; }
        }
      }
      if (picked) continue;

      var mAns = RE_ANSWER_LINE.exec(line);
      if (mAns) { current.inlineLetter = mAns[2]; continue; }

      if (Object.keys(current.options).length === 0) current.text += " " + line;
      else current.noteLines.push(line);
    }
    flush();

    questions.forEach(function (q) { if (!q.n) q.n = ""; });
    topics = topics.filter(function (t) {
      return questions.some(function (q) { return q.t === t; });
    });
    return { questions: questions, topics: topics, problems: problems };
  }

  function fingerprint(q) {
    return normalizeSpace(q.q).toLowerCase() + "|" + q.o.map(function (s) { return normalizeSpace(s).toLowerCase(); }).join("|");
  }

  // Gộp câu mới vào danh sách có trước, bỏ câu trùng, trả về thống kê.
  function merge(existing, incoming) {
    var seen = Object.create(null);
    existing.forEach(function (q) { seen[fingerprint(q)] = true; });
    var added = [], duplicates = 0;
    incoming.forEach(function (q) {
      var key = fingerprint(q);
      if (seen[key]) { duplicates++; return; }
      seen[key] = true;
      added.push(q);
    });
    return { added: added, duplicates: duplicates };
  }

  return {
    parse: parse,
    merge: merge,
    hashId: hashId,
    normalizeTopic: normalizeTopic,
    normalizeSpace: normalizeSpace,
    fingerprint: fingerprint
  };
});
