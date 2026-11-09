"use strict";
/* Kiểm thử bộ phân tích miễn phí (không gọi mạng, không cần CSDL).
   node scripts/test-explainer.js */
const assert = require("assert");
const X = require("./explainer");

let pass = 0,
  fail = 0;
function t(name, fn) {
  try {
    fn();
    pass++;
    console.log("  ✔", name);
  } catch (e) {
    fail++;
    console.log("  ✘", name, "\n      ", e.message.split("\n")[0]);
  }
}
const A = (q, o, a, g) => X.analyze({ q: q, o: o, a: a }, g || null);
const has = (res, re) =>
  re.test(res.head.join(" ")) || re.test(res.options.join(" "));

const GLOSSARY = X.harvestGlossary([
  "Unit 1: Household chores",
  "breadwinner /ˈbredˌwɪn.ər/ (n) : người kiếm tiền chính",
  "do the cooking /duː ðə ˈkʊk.ɪŋ/ (v. phr.) : nấu ăn",
  "artist /ˈɑː.tɪst/ (n) : người nghệ sĩ",
  "audience /ˈɔː.di.əns/ (n) : khán giả",
  "in search of (phrase) : tìm kiếm",
  "musical instrument (n phr) : nhạc cụ",
  "eliminate /ɪˈlɪm.ɪ.neɪt/ (v) : loại bỏ",
  "sustainably (adv) : một cách bền vững",
  "1. The manager ______ the report yesterday.",
  "A. review  B. reviewed",
].join("\n"));

console.log("Danh sách từ vựng của bộ đề");
t("bắt được từ, cụm và nghĩa tiếng Việt", () => {
  assert.ok(GLOSSARY["breadwinner"], "thiếu breadwinner");
  assert.strictEqual(GLOSSARY["artist"].vi, "người nghệ sĩ");
  assert.strictEqual(GLOSSARY["do the cooking"].vi, "nấu ăn");
  assert.ok(GLOSSARY["in search of"], "thiếu cụm in search of");
});
t("không nhầm câu hỏi hoặc dòng đáp án thành từ vựng", () => {
  assert.ok(!GLOSSARY["the manager"], "bị dòng đề bài lọt vào");
  assert.ok(!GLOSSARY["a review"], "bị dòng lựa chọn lọt vào");
  assert.ok(!GLOSSARY["unit 1"], "bị tiêu đề unit lọt vào");
});
t("tra được cả dạng số nhiều / chia thì", () => {
  assert.strictEqual(X.lookup(GLOSSARY, "artists").vi, "người nghệ sĩ");
  assert.strictEqual(X.lookup(GLOSSARY, "eliminated").vi, "loại bỏ");
  assert.strictEqual(X.lookup(GLOSSARY, "do the cooking").vi, "nấu ăn");
});

console.log("Từ loại (họ một gốc từ)");
t("đọc lớp từ của compete/competition/competitor/competitive", () => {
  const r = A(
    "The school is holding a singing ______.",
    ["compete", "competition", "competitor", "competitive"],
    1,
    GLOSSARY,
  );
  assert.strictEqual(r.kind, "family");
  assert.ok(/cần danh từ/.test(r.head.join(" ")), r.head.join(" "));
  assert.ok(/A\. compete — động từ/.test(r.options[0]), r.options[0]);
  assert.ok(/loại \(cần danh từ\)/.test(r.options[3]), r.options[3]);
});
t("danh từ chỉ người vẫn khớp khi chỗ trống cần danh từ", () => {
  const r = A(
    "Each ______ must arrive before the show.",
    ["compete", "competition", "competitor", "competitive"],
    2,
    GLOSSARY,
  );
  assert.strictEqual(r.kind, "family");
  assert.ok(/competitor — danh từ chỉ người ✅/.test(r.options[2]), r.options[2]);
});
t("4 lựa chọn cùng lớp từ → nói rõ câu này kiểm tra nghĩa", () => {
  const r = A(
    "The government wants businesses to produce goods ______.",
    ["harmfully", "sustainably", "harmlessly", "globally"],
    1,
    GLOSSARY,
  );
  assert.ok(/kiểm tra NGHĨA/.test(r.head.join(" ")), r.head.join(" "));
  assert.ok(!/loại/.test(r.options[0]), "không được loại lung tung: " + r.options[0]);
  assert.ok(/một cách bền vững/.test(r.options[1]), r.options[1]);
});
t("không khẳng định sai khi đáp án lệch lớp từ suy ra được", () => {
  const r = A(
    "The new machine makes the production process more ______.",
    ["produce", "product", "productive", "productivity"],
    1, // 'product' — luật 'more + ___' sẽ bắt tính từ, phải im lặng
    GLOSSARY,
  );
  assert.ok(!/cần tính từ/.test(r.head.join(" ")), "nói sai luật: " + r.head.join(" "));
});

console.log("Thì");
t("dấu hiệu yesterday → quá khứ đơn, phân tích đủ 4 dạng", () => {
  const r = A(
    "The manager ______ the quarterly report yesterday afternoon.",
    ["review", "reviewed", "reviews", "reviewing"],
    1,
    GLOSSARY,
  );
  assert.strictEqual(r.kind, "tense");
  assert.ok(/quá khứ đơn/.test(r.head.join(" ")), r.head.join(" "));
  assert.ok(/yesterday/.test(r.head.join(" ")), r.head.join(" "));
  assert.ok(/nguyên thể/.test(r.options[0]), r.options[0]);
  assert.ok(/không phải dạng của quá khứ đơn/.test(r.options[3]), r.options[3]);
});
t("since → hiện tại hoàn thành", () => {
  const r = A("Dr. Clark ______ the materials since 2020.",
    ["connects", "will connect", "connected", "has connected"], 3, GLOSSARY);
  assert.strictEqual(r.kind, "tense");
  assert.ok(/hiện tại hoàn thành/.test(r.head.join(" ")), r.head.join(" "));
});
t("trợ động từ nằm sẵn trong đề (will ______) vẫn nhận đúng", () => {
  const r = A("The crew will ______ the new server tomorrow.",
    ["configure", "configured", "configuring", "configures"], 0, GLOSSARY);
  assert.strictEqual(r.kind, "tense");
  assert.ok(/quá khứ đơn/.test(r.head.join(" ")) === false);
  assert.ok(/tương lai/.test(r.head.join(" ")), r.head.join(" "));
});
t("động từ bất quy tắc went/go được gom cùng một họ", () => {
  const r = A("They ______ to the office every day at 8:00 AM.",
    ["go", "goes", "went", "going"], 1, GLOSSARY);
  assert.strictEqual(r.kind, "tense");
  assert.ok(/hiện tại đơn/.test(r.head.join(" ")), r.head.join(" "));
});

console.log("Giới từ và cụm cố định");
t("participate + in", () => {
  const r = A("Many students participate ______ the competition.",
    ["on", "in", "at", "to"], 1, GLOSSARY);
  assert.strictEqual(r.kind, "prep");
  assert.ok(/participate/.test(r.head.join(" ")), r.head.join(" "));
});
t("cụm có trong danh sách từ của đề (in search of)", () => {
  const r = A("The singer is in search ______ a new style.",
    ["of", "for", "with", "at"], 0, GLOSSARY);
  assert.strictEqual(r.kind, "prep");
  assert.ok(/in search of/.test(r.head.join(" ")), r.head.join(" "));
  assert.ok(/tìm kiếm/.test(r.head.join(" ")), r.head.join(" "));
});
t("on + thứ trong tuần", () => {
  const r = A("The report is due ______ Friday.", ["about", "from", "on", "among"], 2, GLOSSARY);
  assert.strictEqual(r.kind, "prep");
  assert.ok(/on \+ ngày/.test(r.head.join(" ")), r.head.join(" "));
  assert.ok(/không dùng với mốc thời gian/.test(r.options[0]), r.options[0]);
});

console.log("Đại từ");
t("trước danh từ là tính từ sở hữu", () => {
  const r = A("The board members expressed ______ concerns about the budget.",
    ["they", "them", "their", "theirs"], 2, GLOSSARY);
  assert.strictEqual(r.kind, "pronoun");
  assert.ok(/tính từ sở hữu/.test(r.head.join(" ")), r.head.join(" "));
  assert.ok(/đứng MỘT MÌNH/.test(r.options[3]), r.options[3]);
});
t("the employees reminded themselves", () => {
  const r = A("The employees reminded ______ to submit the forms.",
    ["they", "their", "them", "themselves"], 3, GLOSSARY);
  assert.strictEqual(r.kind, "pronoun");
  assert.ok(/phản thân/.test(r.head.join(" ")), r.head.join(" "));
});

console.log("Từ vựng tra nghĩa từ bộ đề");
t("hiện nghĩa tiếng Việt của các lựa chọn", () => {
  const r = A("A person who creates or performs art is an ______.",
    ["artist", "audience", "organizer", "competitor"], 0, GLOSSARY);
  assert.ok(/người nghệ sĩ/.test(r.options[0]), r.options[0]);
  assert.ok(/khán giả/.test(r.options[1]), r.options[1]);
});
t("không bịa nghĩa khi danh sách từ không có", () => {
  const r = A("A person who creates or performs art is an ______.",
    ["widget", "gizmo", "doodad", "thingamajig"], 0, GLOSSARY);
  assert.ok(!/nghĩa:/.test(r.options.join(" ")), "bịa nghĩa: " + r.options.join(" "));
  assert.ok(!/ = \S/.test(r.options.join(" ")), "bịa nghĩa: " + r.options.join(" "));
});

console.log("payload.g: dữ liệu đủ để tái hiện trong trình duyệt");
t("nghĩa và cụm từ tra được lưu lại rồi dùng lại như cũ", () => {
  const stem = "The singer is in search ______ a new style.";
  const opts = ["of", "for", "with", "at"];
  const full = X.analyze({ q: stem, o: opts, a: 0 }, GLOSSARY);
  const hints = X.hintsFor({ q: stem, o: opts }, GLOSSARY);
  assert.ok(hints, "hintsFor trả rỗng");
  const offline = X.analyze({ q: stem, o: opts, a: 0, g: hints }, null);
  assert.strictEqual(offline.kind, full.kind);
  assert.strictEqual(offline.head.join(" "), full.head.join(" "));
  assert.strictEqual(offline.options.join(" "), full.options.join(" "));
});
t("câu không tra được từ nào thì không ghi hints", () => {
  assert.strictEqual(
    X.hintsFor({ q: "The widget ______ the gizmo.", o: ["aaa", "bbb", "ccc", "ddd"] }, GLOSSARY),
    null,
  );
});

console.log("Các mạch phân tích bổ sung (vẫn 0 token)");
t("4 lựa chọn toàn giới từ → nói rõ câu kiểm tra cách dùng giới từ", () => {
  const r = A("The CEO returned _______ Tokyo.", ["about", "from", "over", "through"], 1);
  assert.strictEqual(r.kind, "prep");
  assert.ok(/CÁCH DÙNG/.test(r.head.join(" ")), r.head.join(" "));
  assert.ok(/B\. from — từ/.test(r.options.join(" ")), r.options.join(" "));
});
t("động từ cùng họ nhưng không có dấu hiệu thì → liệt kê 4 dạng, không khẳng định", () => {
  const r = A("The council _______ the equipment.", ["is discussing", "has discussed", "discusses", "discussed"], 2);
  assert.strictEqual(r.kind, "tense");
  assert.ok(/kiểm tra THÌ/.test(r.head.join(" ")), r.head.join(" "));
  assert.ok(!/→ câu ở/.test(r.head.join(" ")), "không được bịa thì khi đề không có dấu hiệu");
});
t("“would have” trong câu điều kiện → quá khứ hoàn thành", () => {
  const r = A(
    "If the system _______ optimized earlier, the error would not have occurred.",
    ["is", "has been", "was", "had been"],
    3,
  );
  assert.strictEqual(r.kind, "tense");
  assert.ok(/quá khứ hoàn thành/.test(r.head.join(" ")), r.head.join(" "));
  assert.ok(/D\. had been/.test(r.options.join(" ")), r.options.join(" "));
});
t("dấu hiệu next month + họ động từ đổi y thành i (apply / applied)", () => {
  const r = A("The supervisor _______ the candidate next month.", ["has applied", "applies", "will apply", "is applying"], 2);
  assert.strictEqual(r.kind, "tense");
  assert.ok(/tương lai đơn/.test(r.head.join(" ")), r.head.join(" "));
  assert.ok(/A\. has applied.*không phải dạng của tương lai đơn/.test(r.options.join(" ")), r.options.join(" "));
});
t("đại từ chỉ định hợp số với động từ phía sau", () => {
  const r = A("_______ are the main reasons for the delay.", ["this", "that", "these", "those"], 2);
  assert.strictEqual(r.kind, "pronoun");
  assert.ok(/số nhiều/.test(r.head.join(" ")), r.head.join(" "));
});
t("so sánh “than that of / those of” được giải thích", () => {
  const r = A(
    "The profits were higher than _______ of its competitors.",
    ["this", "that", "these", "those"],
    3,
  );
  assert.ok(/that of/.test(r.head.join(" ")), r.head.join(" "));
});
t("mệnh đề quan hệ: sau chỗ trống là động từ → loại whom", () => {
  const r = A("The employee _______ was hired last month retired.", ["whom", "who", "whose", "which"], 1);
  assert.strictEqual(r.kind, "pronoun");
  assert.ok(/whom” không dùng được/.test(r.head.join(" ")), r.head.join(" "));
  assert.ok(/A\. whom.*→ loại/.test(r.options.join(" ")), r.options.join(" "));
});
t("đại từ quan hệ sau giới từ → cần tân ngữ, loại dạng chủ ngữ", () => {
  const r = A("The employees, many of _______ had helped the project, were thanked.", ["who", "whom", "whose", "which"], 1);
  assert.strictEqual(r.kind, "pronoun");
  const h = r.head.join(" ");
  assert.ok(/TÂN NGỮ/.test(h), h);
  assert.ok(!/không dùng được/.test(h), "không được loại whom ở câu này");
  assert.ok(/A\. who .*→ loại \(sau giới từ cần tân ngữ\)/.test(r.options.join(" ")), r.options.join(" "));
});
t("decided to + nguyên thể: nhận diện đúng, không nhầm sang giới từ", () => {
  const r = A("The company decided to _______ a new manager.", ["hire", "buy", "sell", "rent"], 0);
  assert.strictEqual(r.kind, "slot");
  assert.ok(/nguyên thể/.test(r.head.join(" ")), r.head.join(" "));
});
t("nhiều lựa chọn cùng thỏa vị trí → không khẳng định đáp án chỉ theo luật từ loại", () => {
  const r = A("The institute decided to _______ the report immediately.", ["subsidize", "collaborate", "verify", "prohibit"], 2);
  assert.ok(!/→ đáp án/.test(r.head.join(" ")), r.head.join(" "));
  assert.ok(/chọn theo NGHĨA/.test(r.head.join(" ")), r.head.join(" "));
});
t("intends to + động từ: các lựa chọn cùng gốc được phân loại đúng", () => {
  const r = A("The customers intend to _______ the current workflow.", ["management", "manage", "manageably", "manageable"], 1);
  assert.strictEqual(r.kind, "family");
  assert.ok(/đáp án B\. manage/.test(r.head.join(" ")), r.head.join(" "));
  assert.ok(/A\. management — danh từ → loại \(cần động từ\)/.test(r.options.join(" ")), r.options.join(" "));
});
t("look forward to + V-ing: KHÔNG khẳng định bừa là nguyên thể", () => {
  const r = A("He is looking forward to _______ the event.", ["attend", "attending", "attention", "attendant"], 1);
  assert.ok(!/nguyên thể/.test(r.head.join(" ")), r.head.join(" "));
});
t("đề không có chỗ trống nhưng 4 lựa chọn cùng gốc → phân tích theo ĐUÔI", () => {
  const r = A("Choose the best word for blank (6).", ["strict", "strictly", "stricter", "strictness"], 1);
  assert.strictEqual(r.kind, "family");
  assert.ok(/cùng gốc “strict”/.test(r.head.join(" ")), r.head.join(" "));
  assert.ok(/đuôi -ly/.test(r.options.join(" ")), r.options.join(" "));
  assert.ok(!/strict — động từ/.test(r.options.join(" ")), "strict không phải động từ");
});
t("câu hỏi nghĩa từ (không chỗ trống) dùng danh sách từ của bộ đề", () => {
  const r = A(
    "Which of the following phrases means 'nấu ăn' in English?",
    ["do the washing-up", "do the cooking", "do the laundry", "do the heavy lifting"],
    1,
    GLOSSARY,
  );
  assert.strictEqual(r.kind, "meaning");
  assert.ok(/“nấu ăn”/.test(r.head.join(" ")), r.head.join(" "));
  assert.ok(/do the cooking = nấu ăn ✅/.test(r.options.join(" ")), r.options.join(" "));
});
t("tính từ đứng trước chỗ trống → chỗ trống cần danh từ", () => {
  const r = A("Generating invoices has streamlined the firm's administrative _______.", ["oversight", "overpass", "overhead", "overkill"], 2);
  assert.strictEqual(r.kind, "slot");
  assert.ok(/sau tính từ “administrative”/.test(r.head.join(" ")), r.head.join(" "));
});
t("danh từ đứng trước (the music ___) không bị gọi là tính từ", () => {
  const r = A("The music ______ supports young artists.", ["organization", "organizer", "organize", "organizing"], 0);
  assert.ok(!/sau tính từ “music”/.test(r.head.join(" ")), r.head.join(" "));
});
t("quá khứ phân từ (was launched ___) không bị gọi là tính từ", () => {
  const r = A("Only after the software was launched _______ the space transferred.", ["has", "did", "was", "had"], 2);
  assert.ok(!/sau tính từ “launched”/.test(r.head.join(" ")), r.head.join(" "));
});
t("comply / apply là động từ dù đuôi -ly", () => {
  const r = A("Ms. Green decided to _______ the facility immediately.", ["incorporate", "comply", "evaluate", "alleviate"], 0);
  assert.ok(!/comply — trạng từ/.test(r.options.join(" ")), r.options.join(" "));
  assert.ok(/B\. comply — động từ/.test(r.options.join(" ")), r.options.join(" "));
});
t("bị động 'was ___ by' -> cần phân từ 2, không gọi là tính từ bổ ngữ", () => {
  const r = A("The committee was _______ by the chairman.", ["appoint", "appointed", "appointing", "appointment"], 1);
  assert.ok(/bị động/.test(r.head.join(" ")), r.head.join(" "));
  assert.ok(!/cần tính từ làm bổ ngữ/.test(r.head.join(" ")), r.head.join(" "));
  assert.ok(!/→ loại/.test(r.options[2]), r.options[2]);
  assert.ok(/→ loại/.test(r.options[3]), r.options[3]);
});
t("nguyên thể của họ động từ được gọi đúng tên (driving -> drive)", () => {
  const r = A("She _______ the office at 8am when the accident happened.", ["drives", "drove", "was driving", "has driven"], 2);
  assert.strictEqual(r.kind, "tense");
  assert.ok(/động từ “drive”/.test(r.head.join(" ")), r.head.join(" "));
});
t("không vừa nói 'chưa xác định được lớp từ' vừa loại lựa chọn", () => {
  const r = A("The telecommunications provider decided to _______ the popular data package.", ["surrender", "supersede", "surveil", "surmount"], 1);
  assert.ok(!/→ loại/.test(r.options.join(" ")), r.options.join(" "));
  assert.ok(!/chưa xác định được lớp từ.*→ loại/.test(r.options[0]), r.options[0]);
});
t("câu đọc hiểu với lựa chọn là cả câu → im lặng, không nói sai", () => {
  const r = A("What is the main purpose of the email?", ["To recruit new developers.", "To notify staff about maintenance.", "To announce a release.", "To cancel the meeting."], 1);
  assert.strictEqual(r.kind, "none");
});

console.log(`\n${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
