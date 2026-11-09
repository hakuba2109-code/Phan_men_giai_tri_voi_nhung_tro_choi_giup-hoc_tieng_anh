
"use strict";
const {$,clamp,msg,confirm:confirmBox}=D3;
/* 🎨 D4: "giảm chuyển động" đọc từ hệ điều hành một lần lúc mở trang. Để RM là `let` (không phải const)
   chỉ vì một lý do: QD.rm(v) bật/tắt được đúng đường này khi kiểm tra đóng băng — khỏi phải đổi cài đặt OS. */
let RM=D3.RM;
const IC=IslandCore, C=IC.CONFIG;   // một nguồn luật duy nhất: server cũng nạp đúng file này

/* ============ 1. HÌNH ẢNH THUẦN (máy nào cũng dựng giống nhau) ============ */

const THEMES=[
 {k:"sakura",ic:"🌸",amb:"petals",fk:["torii","koi","lantern"],
  c:{wall:"#f4e6c8",roof:"#c8553d",wood:"#7a5430",leaf:"#f2a3bf",leaf2:"#e5839f",trunk:"#6b4423",stone:"#c9c8bd",accent:"#e5484d",glow:"#ffe9a8",water:"#6bc4ea",metal:"#d9a441",ground:"#84c88c",sand:"#f0dcc0",sea:"#5fb3d6",sky:"#ffdfea"},
  h:"sakura",t:"sakura"},
 {k:"maple",ic:"🍁",amb:"leaves",fk:["windmill","leafpile","firepit"],
  c:{wall:"#e8d3ad",roof:"#8a4a2b",wood:"#6b4423",leaf:"#e0873a",leaf2:"#c94f2a",trunk:"#5b3b22",stone:"#b8ab97",accent:"#f2b34a",glow:"#ffd08a",water:"#7fb8c9",metal:"#a9783f",ground:"#a8c184",sand:"#e3d19b",sea:"#4f9fbe",sky:"#ffd9a8"},
  h:"maple",t:"maple"},
 {k:"desert",ic:"🌴",amb:"sand",fk:["well","tent","cactus"],
  c:{wall:"#d9a566",roof:"#a9783f",wood:"#8a6d5a",leaf:"#4fae62",leaf2:"#3f9b56",trunk:"#7a5430",stone:"#cbb88f",accent:"#e5484d",glow:"#ffe9a8",water:"#59c2d6",metal:"#c9a227",ground:"#e3c98d",sand:"#f2dfa8",sea:"#4bb0c9",sky:"#ffe9b8"},
  h:"desert",t:"palm"},
 {k:"ice",ic:"❄️",amb:"snow",fk:["snowman","icelake","aurora"],
  c:{wall:"#eef6fb",roof:"#cfe4ef",wood:"#9bb6c4",leaf:"#5fae93",leaf2:"#bfe3f5",trunk:"#7d97a3",stone:"#d7e6ee",accent:"#4a7de0",glow:"#b8ffe8",water:"#9fe0f0",metal:"#cfd8de",ground:"#eaf5fb",sand:"#dbe9f0",sea:"#3f7f9c",sky:"#d8f0ff"},
  h:"ice",t:"pine"},
 {k:"tropic",ic:"🥥",amb:"waves",fk:["waterfall","bridge","boat"],
  c:{wall:"#d8b276",roof:"#a9783f",wood:"#8fae52",leaf:"#3f9b56",leaf2:"#58bd6c",trunk:"#9a7b4f",stone:"#c3c0b0",accent:"#e8703a",glow:"#ffe9a8",water:"#3fd0c9",metal:"#b0894f",ground:"#7fd08a",sand:"#f5e2b0",sea:"#31c1b8",sky:"#c6f2f0"},
  h:"tropic",t:"coconut"},
 {k:"cloud",ic:"☁️",amb:"clouds",fk:["rainbow","balloon","windcloud"],
  c:{wall:"#fdfdff",roof:"#c9d8f2",wood:"#cfd8e6",leaf:"#bfe6ff",leaf2:"#d9c6f5",trunk:"#c3cfe0",stone:"#eef2f8",accent:"#f2b34a",glow:"#fff3c4",water:"#a8d8ff",metal:"#e3e9f0",ground:"#dff0e6",sand:"#f6f2e8",sea:"#bfe0f5",sky:"#e6f4ff"},
  h:"cloud",t:"crystal"},
 {k:"ocean",ic:"🐚",amb:"bubbles",fk:["seaweed","school","chest"],
  c:{wall:"#f0d9e6",roof:"#d8a0c0",wood:"#a5788f",leaf:"#3fbf8f",leaf2:"#e07a9a",trunk:"#9c6f86",stone:"#bfc9d6",accent:"#ffd54a",glow:"#a8f0e0",water:"#4fd0d8",metal:"#e0c060",ground:"#9fdcc4",sand:"#efe0c8",sea:"#2f8fb0",sky:"#bfeef5"},
  h:"ocean",t:"coral"},
 {k:"firefly",ic:"✨",amb:"fireflies",fk:["glowshroom","starpond","observatory"],
  c:{wall:"#e0cfae",roof:"#7a5f9c",wood:"#6b5340",leaf:"#8fd07a",leaf2:"#b9e08a",trunk:"#5b4a38",stone:"#8f8fa6",accent:"#ffd54a",glow:"#c9ff9a",water:"#7fb0d8",metal:"#d9c07a",ground:"#6f9e6a",sand:"#c8bda0",sea:"#2b4a6b",sky:"#c9b8e6"},
  h:"firefly",t:"moss"}
];

const BREEDS=[
 {k:"cat-tabby",sp:"🐱",body:"#e08a3c",dark:"#c56f28",white:"#fbe6c8",ear:"sharp",tail:"long",pat:"stripes",size:.62,muzzle:.5,fluff:0,speed:1.15},
 {k:"cat-calico",sp:"🐱",body:"#f6f0e6",dark:"#4a4a4a",white:"#f6f0e6",ear:"sharp",tail:"long",pat:"patch",size:.6,muzzle:.45,fluff:0,speed:1.1},
 {k:"cat-british",sp:"🐱",body:"#9aa6b2",dark:"#7f8b98",white:"#c6cfd8",ear:"sharp",tail:"puff",pat:"none",size:.68,muzzle:.2,fluff:1,speed:.9},
 {k:"cat-siamese",sp:"🐱",body:"#f0e2cf",dark:"#6b4a35",white:"#f8efe2",ear:"up",tail:"long",pat:"points",size:.6,muzzle:.8,fluff:0,speed:1.25},
 {k:"cat-persian",sp:"🐱",body:"#efe0d0",dark:"#cbb49b",white:"#fff6ec",ear:"sharp",tail:"puff",pat:"none",size:.72,muzzle:.1,fluff:2,speed:.75},
 {k:"cat-cloud",sp:"🐱",body:"#b9a8e6",dark:"#8d76c9",white:"#e6dcff",ear:"up",tail:"puff",pat:"glow",size:.66,muzzle:.4,fluff:1,speed:1.2},
 {k:"dog-village",sp:"🐶",body:"#d8a556",dark:"#a8763a",white:"#f0dcb8",ear:"up",tail:"long",pat:"none",size:.7,muzzle:.7,fluff:0,speed:1.35},
 {k:"dog-corgi",sp:"🐶",body:"#e0a55c",dark:"#b47c34",white:"#fbeedd",ear:"up",tail:"puff",pat:"patch",size:.62,muzzle:.6,fluff:0,speed:1.4},
 {k:"dog-shiba",sp:"🐶",body:"#e08a3c",dark:"#b8652a",white:"#fbeedd",ear:"up",tail:"curl",pat:"none",size:.68,muzzle:.65,fluff:1,speed:1.35},
 {k:"dog-husky",sp:"🐶",body:"#a8b0ba",dark:"#6b7480",white:"#f2f5f8",ear:"up",tail:"curl",pat:"patch",size:.76,muzzle:.7,fluff:1,speed:1.5},
 {k:"dog-poodle",sp:"🐶",body:"#e8c6b8",dark:"#cfa393",white:"#f8e6dc",ear:"flop",tail:"puff",pat:"curl",size:.6,muzzle:.5,fluff:2,speed:1.2},
 {k:"dog-cloud",sp:"🐶",body:"#c9d3e6",dark:"#94a5c4",white:"#eef3fb",ear:"up",tail:"curl",pat:"glow",size:.72,muzzle:.6,fluff:1,speed:1.5}
];
/* Tên, giá, ngưỡng thân thiết đều lấy từ C (island-core) — trang này không tự khai số nào. */
const friendLv=IC.friendLv;
const foodOf=(k)=>C.foods.find((f)=>f.k===k);
const breedOf=(k)=>Object.assign({},BREEDS.find((b)=>b.k===k)||{},C.breeds.find((b)=>b.k===k)||{});
const themeOf=(n)=>{const i=(((n|0)-1)%C.themes.length+C.themes.length)%C.themes.length;return Object.assign({},THEMES[i]||{},C.themes[i])};

/* Hình học đảo (seed, genIsland, edgeOf, walkable, pickSpot) TỪ 04/11 nằm ở island-core.js:
   server cần dựng lại đúng mặt đảo để tự kiểm chỗ đặt đồ trang trí, nên trang không tự khai nữa.
   TOD chỉ là nhãn hiển thị; bán kính ô đất (ob) giờ đến từ C.themes[].feo. */
const {hash, rand, edgeOf, genIsland, walkable, pickSpot, treeSpot, doorSpot, GEO} = IC;
const TOD=["Sáng","Trưa","Hoàng hôn","Đêm"];

/* ============ 2. TRẠNG THÁI (đọc từ /api/islands — đây là VÍ XU THẬT, không có số giả) ============ */
/* PUT dùng cho một đường duy nhất: /decor/layout (thay cả bố cục một đảo). */
const api=(p,b,method)=>fetch(p,{method:method||(b?"POST":"GET"),headers:b?{"Content-Type":"application/json"}:undefined,credentials:"same-origin",body:b?JSON.stringify(b):undefined})
 .then(r=>r.json().catch(()=>({})).then(j=>({ok:r.ok,j})));

/* Khung rỗng để cảnh 3D dựng được ngay, trước khi server trả lời. Toàn bộ số liệu thật đến từ /api/islands. */
function blank(){return{coins:0,cur:1,unlocked:1,islands:{1:IC.emptySlots()},upCost:IC.emptySlots().map(()=>IC.costOf(1,0)),
 seen:C.seenFirst,map:[{index:1,theme:C.themes[0].k,lap:0,cost:IC.islandCost(1),factor:1,levels:IC.emptySlots(),done:false,locked:false}],
 islandCost:IC.islandCost(1),factor:1,done:false,pets:[],pantry:{},income:{lesson:0,game:0,file:0,login:0,streak:0,garden:0},left:{},gift:null,today:null,LIVE:false,
 decor:{owned:{},total:{},placed:{},styles:{},styleOwned:[],left:{}},
 caps:{mealsPerDay:C.mealsPerDay,caresPerDay:C.caresPerDay,lesson:null},
 eco:localStorage.getItem("qd-eco")==="1"}}
let S=blank();
const slotName=i=>i===0?"Nhà":i===1?"Cây":themeOf(S.cur).features[i-2].name;
const slotIcon=i=>i===0?"🏠":i===1?"🌳":themeOf(S.cur).features[i-2].icon;

function apply(v){
 const eco=S.eco;
 S={coins:v.xu, cur:v.island.current, unlocked:v.island.unlocked, islands:v.island.slots, upCost:v.island.upCost,
    seen:v.island.seen, map:v.island.map, islandCost:v.island.cost, factor:v.island.factor, done:v.island.done,
    pets:v.pets.map(p=>({id:p.id,breed:p.breed,name:p.name,xp:p.friendXp,level:p.level,sat:p.satiety,mood:p.mood,meals:p.meals,cares:p.cares})),
    pantry:v.pantry, income:v.income, left:v.left, gift:v.gift, caps:v.caps, today:v.today, LIVE:true, eco,
    decor:v.decor||S.decor};
 /* mua đồ / đổi đảo thì nháp soi lại máy chủ; đang sửa dở (DEC.dirty) thì giữ nguyên, không đè. */
 if(!decDirty())decOpen();
 /* 🎨 D4: đổi phong cách (giờ · cỏ · trời · thời tiết) không làm slots đổi, nên VISIT.sync không rebuild —
    phải tự so chữ ký 4 nhánh mà dựng lại cảnh. Draft đang sửa dở vẫn giữ (drawDecor đọc DEC.items). */
 if(DEC3)DEC3.refresh();
 render();
}
function pull(){
 return api("/api/islands").then(({ok,j})=>{
  if(!ok){needServer(j&&j.error?j.error:"");render();return false}
  apply(j);return true;
 }).catch(()=>{needServer("");render();return false});
}
const needServer=(why)=>{$("panel").innerHTML=`<h2>🏝️ Trang cần máy chủ</h2><p class="mute">Số dư và tiến độ đảo đọc từ <code>GET /api/islands</code> nên phải mở trang qua <code>http://localhost:3000/quan-dao-vo-tan-three.html</code> (đã đăng nhập hoặc làm Khách đều được). ${why} Không còn nút giả lập: trang không tự cộng xu — mọi xu đến từ bài học, trò chơi, file nộp và quà.</p>`};

/* ============ 3. HÀNH ĐỘNG (server tính giá và trừ xu; lỗi thì không có gì đổi) ============ */
let BUSY=false;
function act(path,body,then,method){
 if(BUSY)return; BUSY=true;
 api(path,body,method).then(({ok,j})=>{
  BUSY=false;
  if(!ok){msg(j&&j.error?j.error:"Máy chủ không trả lời — đảo, thú và ví vẫn nguyên.");return}
  apply(j); if(then)then(j);
 }).catch(()=>{BUSY=false;msg("Không gọi được máy chủ — đảo, thú và ví vẫn nguyên, bạn thử lại nhé.")});
}
function doUpgrade(i){
 const arr=S.islands[S.cur]||IC.emptySlots(), lv=arr[i], c=S.upCost[i];
 if(!S.LIVE){needServer("");return}
 if(lv>=C.maxLevel){msg(`${slotName(i)} đã ở cấp tối đa (${C.maxLevel}/${C.maxLevel}).`);return}
 if(c===null||S.coins<c){msg(`Cần ${c} xu để nâng ${slotName(i)} lên cấp ${lv+1}. Ví bạn có ${S.coins} xu — còn thiếu ${c-S.coins}. Chưa có gì bị trừ.`);return}
 confirmBox(`${slotName(i)} → cấp ${lv+1}`,`Trả ${c} xu từ ví chung (cùng ví với thị trấn, cây anh đào và trò chơi). Còn ${S.coins-c} xu. Nâng cấp không hoàn lại nhưng cũng không mất gì thêm.`,
  ()=>act("/api/islands/upgrade",{slot:i},(j)=>{
   const r=j.result; VISIT&&VISIT.grow(i);
   if(r.completed){
    const nx=themeOf(r.nextIsland.index);
    VISIT&&VISIT.celebrate();
    msg(`🎉 Đảo ${r.island} HOÀN CHỈNH! Mở đảo ${r.nextIsland.index} — ${nx.ic} ${nx.name}. Thú nhảy lên thuyền theo bạn, số chỗ thú ra đảo tăng lên ${j.island.seen}. Đảo cũ vẫn nguyên, ghé thăm bất cứ lúc nào.`);
   } else msg(`Đã nâng ${r.slotName} lên cấp ${r.level} (−${r.cost} xu). Ví còn ${j.xu} xu.`);
  }));
}
function travel(n){
 if(n>S.unlocked){msg(`Đảo ${n} còn khóa. Hoàn chỉnh đảo ${S.cur} (đủ ${C.slots} ô cấp ${C.maxLevel}) để mở tiếp — không có cách nào tắt.`);return}
 if(n===S.cur){msg("Bạn đang đứng ở đảo này.");return}
 const th=themeOf(n), m=S.map.find((x)=>x.index===n)||{cost:IC.islandCost(n),factor:IC.factor(n)};
 withDecGuard(()=>confirmBox(`Du thuyền sang đảo ${n}`,`${th.ic} ${th.name}. Mọi đảo đã mở giữ nguyên tiến độ; thú đi theo bạn.`,
  ()=>act("/api/islands/travel",{index:n},()=>msg(`⛵ Đã sang đảo ${n} · ${th.ic} ${th.name}. Đảo này cần ${m.cost} xu để hoàn chỉnh (hệ số ${m.factor.toFixed(2)} so với đảo 1).`))));
}
function adopt(bk,name){
 const b=breedOf(bk), nm=(name||"").trim();
 if(S.coins<b.price){msg(`Cần ${b.price} xu cho ${b.icon} ${b.name}. Ví bạn có ${S.coins} xu — còn thiếu ${b.price-S.coins}. Chưa có gì bị trừ.`);return}
 confirmBox(`Nhận nuôi ${b.icon} ${b.name}`,`${b.price} xu · hạng ${"⭐".repeat(b.rarity)}. Tên: ${nm||"(để hệ thống đặt)"}. Thú không bao giờ ốm, chết hay bỏ đi.`,
  ()=>act("/api/islands/adopt",{breed:bk,name:nm},(j)=>{
   const p=j.pets[j.pets.length-1];
   msg(`🐾 ${p.name} về đảo ${j.island.current}! ${j.pets.length} thú (hiển thị tối đa ${j.island.seen}, số còn lại "đang ngủ trong nhà" và thay phiên ra chơi).`);
  }));
}
function buyFood(fk,q){
 const f=foodOf(fk);
 act("/api/islands/food",{item:fk,qty:q},(j)=>msg(`🍖 Đã mua ${q}× ${f.name} (−${f.price*q} xu). Trong kho: ${j.pantry[fk]}. Xu đổi thành đồ ăn, không mất gì cả.`));
}
function feed(id,fk){
 const p=S.pets.find((x)=>x.id===id), f=foodOf(fk); if(!p||!f)return;
 act("/api/islands/feed",{petId:id,item:fk},(j)=>{
  const n=j.pets.find((x)=>x.id===id)||p; VISIT&&VISIT.eat(id,fk);
  msg(`🍖 ${n.name} ăn ${f.name}: No ${Math.round(n.sat)}/100 · Vui ${Math.round(n.mood)}/100 · +${f.aff} thân thiết (cấp ${n.level}/${C.friendXp.length}).`);
 });
}
function care(id,kind){
 const p=S.pets.find((x)=>x.id===id); if(!p)return;
 act("/api/islands/care",{petId:id,action:kind},(j)=>{
  const n=j.pets.find((x)=>x.id===id)||p; VISIT&&VISIT[kind==="play"?"play":"react"](id);
  msg(kind==="play"?`🎾 Bạn ném bóng, ${n.name} chạy đi tha về. Vui ${Math.round(n.mood)}/100.`:`🤚 ${n.name} dụi vào tay bạn. Vui ${Math.round(n.mood)}/100 · thân thiết cấp ${n.level}/${C.friendXp.length}.`);
 });
}

/* ============ 4. GIAO DIỆN DANH SÁCH CHỮ (bàn phím + trình đọc màn hình) ============ */
const TABS=[["island","🏝️ Đảo của tôi"],["map","🗺️ Quần đảo"],["home","🐾 Chuồng thú"],["shop","🛒 Cửa hàng thú"],["food","🍖 Thức ăn"],["decor","🎨 Trang trí"],["coll","📚 Bộ sưu tập"]];
let TAB="island", VISIT=null, DEC3=null;
$("tabs").innerHTML=TABS.map(t=>`<button role="tab" data-tab="${t[0]}" aria-selected="false">${t[1]}</button>`).join("");
[...$("tabs").children].forEach(b=>b.onclick=()=>{
 /* bấm lại tab đang mở thì không làm gì cả — khỏi mất nháp vì một cú chạm thừa */
 if(b.dataset.tab===TAB)return;
 withDecGuard(()=>{if(b.dataset.tab==="decor")decOpen();TAB=b.dataset.tab;render()})});
function bar(v,m){return`<div class="bar" role="img" aria-label="${Math.round(v)} trên ${m}"><i style="width:${clamp(v/m*100,0,100)}%"></i></div>`}
/* Vẽ lại cả bảng mà không mất chỗ đang gõ phím: nhớ nút đang được fokus rồi trả fokus về nút cùng tên. */
function focusKey(){const a=document.activeElement;
 if(!a||a===document.body||a===document.documentElement||!a.dataset)return null;
 if(a.id)return"#"+a.id;
 for(const k of["data-sel","data-store2","data-addarea","data-hold","data-buy","data-area","data-nudge","data-sbuy","data-spick","data-sreset"])
  if(a.dataset[k]!==undefined)return`[${k}="${a.dataset[k]}"]`;
 return null}
function render(){
 const fk=focusKey();
 $("chipCoin").textContent=`🪙 ${S.coins} xu (ví chung)`;
 $("chipDay").textContent=S.LIVE?`📖 hôm nay ${S.income.lesson}/${S.caps.lesson||"?"} xu bài học · còn ${S.left.lesson||0} chỗ`:"📖 chưa đọc được ví";
 $("chipSeen").textContent=`🐾 ${S.pets.length} thú · ra đảo ${Math.min(S.seen,S.pets.length)}/${S.seen}`;
 [...$("tabs").children].forEach(b=>b.setAttribute("aria-selected",String(b.dataset.tab===TAB)));
 $("panel").innerHTML=({island:pIsland,map:pMap,home:pHome,shop:pShop,food:pFood,decor:pDecor,coll:pColl})[TAB]();
 if(TAB!=="decor")DEC3&&DEC3.ghost(null);
 wire();
 if(fk){const el=$("panel").querySelector(fk);if(el)el.focus()}
 VISIT&&VISIT.sync();
}
function pIsland(){
 const L=genIsland(S.cur),T=themeOf(S.cur),arr=S.islands[S.cur]||IC.emptySlots();
 return`<h2>${T.ic} Đảo ${S.cur} · ${T.name}${L.lap>0?" · biến thể "+TOD[L.tod]:" · gốc"}</h2>
 <p class="mute">Bán kính ${L.r.toFixed(1)} · seed ${hash("iso-"+S.cur)} (mọi người chơi thấy cùng đảo ${S.cur}). ${C.slots} ô cấp ${C.maxLevel} = hoàn chỉnh → mở đảo ${S.cur+1}. Cả đảo: <b>${S.islandCost} xu</b> (hệ số ${S.factor.toFixed(2)}), ≈ ${(S.islandCost/45).toFixed(1)} ngày chơi thường.</p>
 <div class="plots">${arr.map((lv,i)=>{const c=S.upCost[i];
  return`<button data-up="${i}" ${c!==null&&S.coins>=c?"":"disabled"} aria-label="${slotName(i)}, cấp ${lv} trên ${C.maxLevel}">${slotIcon(i)} ${slotName(i)} · C${lv}/${C.maxLevel}<br><small>${c===null?"Tối đa":"Nâng "+c+" xu"+(S.coins<c?" · thiếu "+(c-S.coins):"")}</small></button>`}).join("")}</div>
 <div class="ctl">
  <button id="e5">⛵ Sang đảo ${S.cur+1}</button>
  <button id="e6">📣 Gọi thú</button></div>
 <p class="mute">Ví hôm nay nhận: 📖 ${S.income.lesson} · 🎮 ${S.income.game} · 📄 ${S.income.file} · 🔑 ${S.income.login} · 🔥 ${S.income.streak} · 🌷 ${S.income.garden} xu.
  Trang này <b>chỉ tiêu xu</b> — không có nút cộng xu: xu đến từ bài học (trần ${S.caps.lesson} xu/ngày), trò chơi, nộp file tài liệu, quà đăng nhập và chuỗi ngày học. Bấm thú trong cảnh 3D chỉ để chào — <b>không thưởng</b>.</p>
 <button id="ck">🧪 Tự kiểm tra hình đảo</button><div class="chk" id="chk"></div>`;
}
function pMap(){
 let h=`<h2>🗺️ Bản đồ quần đảo</h2><p class="mute">Catalog ${C.themes.length} chủ đề thiết kế tay, sinh biến thể theo seed nên đảo 9, 50, 500… vẫn có chủ đề + màu + giờ + hình dáng riêng. Đã mở: ${S.unlocked}. Không có đảo cuối cùng.</p><div class="grid">`;
 for(const m of S.map){
  const T=themeOf(m.index),lv=m.levels.reduce((s,x)=>s+x,0),max=C.slots*C.maxLevel;
  h+=`<div class="item${m.locked?" locked":""}"><h3>${T.ic} Đảo ${m.index} · ${T.name}</h3>
   <div class="mute">${m.locked?"🔒 cần hoàn chỉnh đảo trước":(m.lap>0?"vòng "+(m.lap+1)+" · "+TOD[genIsland(m.index).tod]:"gốc")}</div>${bar(lv,max)}
   <div class="mute">${m.done?"🏆 hoàn chỉnh — đảo cũ vẫn ghé được":"cả đảo "+m.cost+" xu"}</div>
   <button data-go="${m.index}" ${m.locked?"disabled":""}>${m.index===S.cur?"Bạn đang ở đây":"Đến đảo "+m.index}</button></div>`;
 }
 return h+"</div>";
}
function pHome(){
 if(!S.pets.length)return`<h2>🐾 Chuồng thú</h2><p class="mute">Chưa có thú nào. Sang tab 🛒 Cửa hàng thú — giá niêm yết từng giống, không có hộp quà ngẫu nhiên.</p>`;
 let h=`<h2>🐾 Chuồng thú (${S.pets.length})</h2><p class="mute">No bụng và Vui vẻ có <b>sàn ${C.satietyFloor}</b>: đói chỉ làm thú buồn ngủ, không phạt. Thân thiết chỉ tăng (ngưỡng ${C.friendXp.join(", ")} XP) và mở phụ kiện ở cấp 3 · 5 · 7.</p><div class="grid">`;
 for(const p of S.pets){
  const b=breedOf(p.breed);
  h+=`<div class="item"><h3>${b.icon} ${p.name} <small>${"⭐".repeat(b.rarity)}</small></h3>
   <div class="mute">thân thiết ${p.level}/${C.friendXp.length} · bữa hôm nay ${p.meals}/${S.caps.mealsPerDay}</div>
   No bụng ${Math.round(p.sat)}/100${bar(p.sat,100)}Vui vẻ ${Math.round(p.mood)}/100${bar(p.mood,100)}
   ${C.foods.map(f=>`<button data-feed="${p.id}:${f.k}" ${(p.meals<S.caps.mealsPerDay&&(S.pantry[f.k]||0)>0)?"":"disabled"}>${f.icon} +${f.aff}</button>`).join(" ")}
   <div class="ctl" style="margin-top:6px"><button data-care="${p.id}:pet">🤚 Vuốt ve</button><button data-care="${p.id}:play">🎾 Chơi bóng</button></div></div>`;
 }
 return h+"</div>";
}
function pShop(){
 return`<h2>🛒 Cửa hàng thú</h2><p class="mute">${C.breeds.length} giống, giá niêm yết theo hạng (server giữ giá, giao diện chỉ hiển thị). Độ hiếm chỉ làm thú <b>lạ hơn về hình</b>, không con nào kiếm thêm xu hay giúp học.</p><div class="grid">
 ${C.breeds.map(b=>{const v=breedOf(b.k);return`<div class="item"><h3>${b.icon} ${b.name}</h3><div class="mute">${"⭐".repeat(b.rarity)} · ${b.price} xu · tốc ${v.speed.toFixed(2)}</div>
  <input type="text" data-nm="${b.k}" placeholder="Tên thú (tùy chọn)" aria-label="Tên cho ${b.name}">
  <button class="pri" data-adopt="${b.k}" ${S.coins>=b.price?"":"disabled"}>Nhận nuôi ${b.price} xu${S.coins<b.price?" · thiếu "+(b.price-S.coins):""}</button></div>`}).join("")}</div>`;
}
function pFood(){
 return`<h2>🍖 Cửa hàng thức ăn</h2><p class="mute">Mỗi thú tối đa ${S.caps.mealsPerDay} bữa/ngày; vuốt ve và chơi bóng miễn phí, ${S.caps.caresPerDay} lần/ngày. Mua thức ăn trừ xu MỘT lần, cho ăn không trừ thêm.</p><div class="grid">
 ${C.foods.map(f=>`<div class="item"><h3>${f.icon} ${f.name}</h3><div class="mute">${f.price} xu · +${f.aff} thân thiết · trong kho: ${S.pantry[f.k]||0}</div>
  <button data-food="${f.k}:1" ${S.coins>=f.price?"":"disabled"}>Mua 1</button> <button data-food="${f.k}:5" ${S.coins>=f.price*5?"":"disabled"}>Mua 5</button></div>`).join("")}</div>`;
}
function pColl(){
 return`<h2>📚 Bộ sưu tập</h2><p class="mute">Giống chưa có hiển thị mờ nhưng vẫn mua được bình thường (không có ngẫu nhiên).</p><div class="grid">
 ${C.breeds.map(b=>{const have=S.pets.filter(p=>p.breed===b.k);
  return`<div class="item${have.length?"":" locked"}"><h3>${b.icon} ${b.name}</h3><div class="mute">${"⭐".repeat(b.rarity)} · ${have.length?"đã nuôi ×"+have.length+" ("+have.map(x=>x.name).join(", ")+")":"chưa có"}</div></div>`}).join("")}</div>`;
}
function wire(){
 const q=(sel,fn)=>$("panel").querySelectorAll(sel).forEach(e=>e.onclick=()=>fn(e));
 q("[data-up]",e=>doUpgrade(+e.dataset.up));
 const g=id=>$(id);
 if(g("e6"))g("e6").onclick=()=>{if(VISIT&&VISIT.call)VISIT.call();else msg("Máy này không chạy được WebGL nên thú không hiện ra — mọi bảng bằng bàn phím vẫn dùng được bình thường.")};
 if(g("e5"))g("e5").onclick=()=>travel(S.cur+1);
 if(g("ck"))g("ck").onclick=runChecks;
 q("[data-go]",e=>travel(+e.dataset.go));
 q("[data-adopt]",e=>adopt(e.dataset.adopt,($("panel").querySelector(`[data-nm="${e.dataset.adopt}"]`)||{}).value));
 q("[data-food]",e=>{const[a,b]=e.dataset.food.split(":");buyFood(a,+b)});
 q("[data-feed]",e=>{const[a,b]=e.dataset.feed.split(":");feed(+a,b)});
 q("[data-care]",e=>{const[a,b]=e.dataset.care.split(":");care(+a,b)});
 /* 🎨 trang trí — dùng lại g(id) ở trên, không thêm bộ chọn trùng */
 if(g("dSave"))g("dSave").onclick=decSave;
 if(g("dCancel"))g("dCancel").onclick=decCancel;
 if(g("dUndo"))g("dUndo").onclick=decUndo;
 if(g("dRedo"))g("dRedo").onclick=decRedo;
 if(g("dRot"))g("dRot").onclick=()=>decRotate(DEC.sel);
 if(g("dStore"))g("dStore").onclick=()=>decStore(DEC.sel);
 if(g("dPerf"))g("dPerf").onclick=()=>{if(!DEC3){msg("Máy này không có WebGL nên không đo được khung hình 3D — phần chữ và luật đặt vẫn chạy đủ.");return}msg("⏱ Đang vẽ 60 khung hình để đo…");DEC3.perfReport()};
 q("[data-buy]",e=>decBuy(e.dataset.buy,1));
 q("[data-hold]",e=>decHold(e.dataset.hold));
 q("[data-addarea]",e=>decAddArea(e.dataset.addarea));
 q("[data-sel]",e=>decSelect(+e.dataset.sel));
 q("[data-store2]",e=>decStore(+e.dataset.store2));
 q("[data-nudge]",e=>{const[a,b]=e.dataset.nudge.split(":");decNudgeSel(+a,+b)});
 q("[data-area]",e=>{DEC.area=e.dataset.area;setWhy("ok",`Khu đang chọn: ${areaOf(DEC.area).ic} ${areaOf(DEC.area).name} — bấm "Thêm vào đảo" ở một món để đặt vào chỗ trống hợp lệ đầu tiên của khu này.`);render()});
 /* 🎨 D4: phong cách — Mua chỉ tiêu xu ở nút "Mở"; Bật/Tắt miễn phí và không đụng layout_ver. */
 q("[data-sbuy]",e=>styBuy(e.dataset.sbuy));
 q("[data-spick]",e=>{const[k,v]=e.dataset.spick.split(":");styPick(k,v)});
 q("[data-sreset]",e=>styPick(e.dataset.sreset,null));
}
/* Bản bàn phím: R xoay, Delete cất, mũi tên nhích 0,25 — chỉ khi đang ở tab 🎨 và không gõ chữ. */
addEventListener("keydown",e=>{
 if(TAB!=="decor"||DEC.sel<0)return;
 if(e.target&&e.target.closest&&e.target.closest("input,select,textarea"))return;
 const k=e.key;
 if(k==="r"||k==="R"){decRotate(DEC.sel);e.preventDefault();return}
 if(k==="Delete"||k==="Backspace"){decStore(DEC.sel);e.preventDefault();return}
 const mv={ArrowUp:[0,-.25],ArrowDown:[0,.25],ArrowLeft:[-.25,0],ArrowRight:[.25,0]}[k];
 if(mv){decNudgeSel(mv[0],mv[1]);e.preventDefault()}
});

/* ============ 5. TRANG TRÍ 🎨 (D3) — khay đồ, bản nháp, bóng xem trước, bản bàn phím ============ */
/* Luật đặt nằm ở island-core.js (canPlace) — cùng file máy chủ chạy lại khi lưu, nên giao diện
   chỉ tô xanh/đỏ và in đúng dòng lý do máy chủ sẽ dùng, không tự viết câu chữ riêng. */
const LIM=IC.DECOR;
const DEC={items:[],hist:[],redo:[],pick:null,sel:-1,dirty:false,ver:0,area:"yard",why:"",whyKind:"ok"};
const decPlaced=()=>(S.decor&&S.decor.placed&&S.decor.placed[S.cur])||[];
const decVer=()=>{const st=S.decor&&S.decor.styles&&S.decor.styles[S.cur];return st?+st.layoutVer||0:0};
const decDirty=()=>TAB==="decor"&&DEC.dirty;
/* Khu vực cho bản bàn phím. Mỗi khu một hàm chấm điểm: điểm càng nhỏ thì càng "đúng chất" khu đó.
   Sân nhà/Quanh cây/Lối đi đo từ một mốc trên đảo; Bờ nước/Ngoài rìa đo từ mép nước lùi vào. */
const AREAS=[
 {k:"yard",ic:"🏠",name:"Sân nhà",s:(L,x,z)=>Math.abs(Math.hypot(x-L.slots[0].x,z-L.slots[0].z)-(L.slots[0].ob+1.6))},
 {k:"tree",ic:"🌳",name:"Quanh cây",s:(L,x,z)=>Math.abs(Math.hypot(x-L.slots[1].x,z-L.slots[1].z)-(L.slots[1].ob+1.6))},
 {k:"path",ic:"🪨",name:"Lối đi",s:(L,x,z)=>{const h=L.slots[0],t=L.slots[1];return Math.abs(Math.hypot(x-(h.x+t.x)/2,z-(h.z+t.z)/2)-0.4)}},
 {k:"rim",ic:"🌫️",name:"Ngoài rìa",s:(L,x,z)=>Math.abs((edgeOf(L,Math.atan2(z,x))-Math.hypot(x,z))-3)},
 {k:"shore",ic:"🌊",name:"Bờ nước",s:(L,x,z)=>Math.abs((edgeOf(L,Math.atan2(z,x))-Math.hypot(x,z))-1.3)}];
const areaOf=k=>AREAS.find(a=>a.k===k)||AREAS[0];

/* Nhích 0,25 theo góc nhìn: bàn phím dùng phím mũi tên, màn hình dọc dùng 4 nút. */
function decNudgeSel(dx,dz){if(DEC.sel<0||!DEC.items[DEC.sel])return;decMove(DEC.sel,dx,dz)}

function decMove(i,dx,dz){
 const p=DEC.items[i];if(!p)return;
 const x=IC.snap(p.x+dx),z=IC.snap(p.z+dz);
 if(x===p.x&&z===p.z)return;
 const r=decTry(p.item,x,z,p.rot,i);
 if(!r.ok){setWhy("bad","Chưa nhích được: "+r.reason);return}
 decSnap();p.x=x;p.z=z;DEC.dirty=true;setWhy("ok",`Đã nhích ${IC.decorOf(p.item).icon} ${IC.decorOf(p.item).name} tới (${x}, ${z}) — chưa lưu.`);decSync3();render()}

function decRotate(i){
 const p=DEC.items[i];if(!p)return;
 const rot=(p.rot+1)%LIM.rotSteps;
 const r=decTry(p.item,p.x,p.z,rot,i);
 if(!r.ok){setWhy("bad","Xoay không được: "+r.reason);return}
 decSnap();p.rot=rot;DEC.dirty=true;setWhy("ok",`Đã xoay ${IC.decorOf(p.item).icon} ra hướng ${rot*45}° — chưa lưu.`);decSync3();render()}

function decStore(i){
 const p=DEC.items[i];if(!p)return;
 const it=IC.decorOf(p.item);
 decSnap();DEC.items.splice(i,1);DEC.sel=-1;DEC.dirty=true;
 setWhy("ok",`🗑 Đã cất ${it.icon} ${it.name} vào kho (miễn phí, không hoàn xu). Bấm Lưu để ghi.`);decSync3();render()}

/* Chạy lại luật trên chính cây đảo này, loại món đang xét ra khỏi nền (nếu món đã nằm sẵn ở đó). */
function decTry(key,x,z,rot,skipIdx){
 const L=genIsland(S.cur),base=DEC.items.filter((_,j)=>j!==skipIdx);
 return IC.canPlace(L,base,key,x,z,rot,{slots:S.islands,baseFraction:decBase()})}

/* Độ liền khối của đảo TRỐNG — tính một lần mỗi đảo, luật 9 so với min(98%, mức này). */
function decBase(){
 if(decBase.n===S.cur&&decBase.v!==null)return decBase.v;
 const L=genIsland(S.cur),v=IC.walkFraction(L,[]);
 decBase.n=S.cur;decBase.v=v;return v}

/* Số cái còn được đặt ở đảo này = đã mua − đang đặt ở đảo khác − đang nằm trong nháp của đảo này. */
function decLeft(key){
 const owned=+(S.decor&&S.decor.owned[key])||0;
 let other=0;
 for(const[n,arr]of Object.entries((S.decor&&S.decor.placed)||{})){if(+n===S.cur)continue;for(const p of arr||[])if(p.item===key)other++}
 return owned-other-DEC.items.filter(p=>p.item===key).length}

function decSnap(){DEC.hist.push(JSON.stringify(DEC.items));if(DEC.hist.length>60)DEC.hist.shift();DEC.redo.length=0}
function decUndo(){
 if(!DEC.hist.length)return;
 DEC.redo.push(JSON.stringify(DEC.items));DEC.items=JSON.parse(DEC.hist.pop());DEC.sel=-1;
 setWhy("ok","↶ Đã hoàn tác một bước — vẫn là bản nháp, bấm Lưu khi vừa ý.");decSync3();render()}
function decRedo(){
 if(!DEC.redo.length)return;
 DEC.hist.push(JSON.stringify(DEC.items));DEC.items=JSON.parse(DEC.redo.pop());DEC.sel=-1;
 setWhy("ok","↷ Đã làm lại.");decSync3();render()}

/* decSync3 = điểm tựa cho ba hàm 3D; máy không có WebGL thì bảng chữ vẫn chạy đủ. */
function decSync3(){DEC3&&DEC3.draw()}
function setWhy(kind,text){
 if(!text)return;DEC.why=text;DEC.whyKind=kind;
 const el=$("decWhy");
 if(el){el.textContent=text;el.className="why "+kind}}

function decHold(key){
 const it=IC.decorOf(key);if(!it)return;
 DEC.pick=DEC.pick===key?null:key;DEC.sel=-1;
 setWhy("ok",DEC.pick?`Đang cầm ${it.icon} ${it.name}: rê chuột (hoặc chạm) lên mặt đảo để xem bóng — xanh là đặt được, đỏ kèm lý do.`:"Đã đặt món xuống, không theo con trỏ nữa.");
 render()}

function decAdd(key,x,z,rot){
 const r=decTry(key,x,z,rot,-1);
 if(!r.ok){setWhy("bad",`Chưa đặt được ${IC.decorOf(key).name}: ${r.reason}`);return false}
 if(decLeft(key)<1){setWhy("bad",`Hết ${IC.decorOf(key).name} trong kho — số đã mua đang đặt chỗ khác hết rồi. Bấm Mua trước đã.`);return false}
 decSnap();DEC.items.push({item:key,x,z,rot:rot||0});DEC.sel=DEC.items.length-1;DEC.dirty=true;
 setWhy("ok",`✅ Đã đặt ${IC.decorOf(key).icon} ${IC.decorOf(key).name} tại (${x}, ${z}) — bản nháp. Bấm Lưu để ghi.`);
 decSync3();render();return true}

/* "Thêm vào đảo" cho người dùng bàn phím: quét lưới, giữ chỗ hợp lệ gần tâm khu nhất.
   Bước quét phải là bội của lưới 0,25 (LIM.grid) — canPlace từ chối mọi vị trí lệch lưới. */
function decAreaList(key){
 const L=genIsland(S.cur),A=areaOf(DEC.area),out=[];
 for(let ix=Math.ceil(-L.r/.5);ix*.5<=L.r;ix++)for(let iz=Math.ceil(-L.r/.5);iz*.5<=L.r;iz++){
  const x=ix*.5,z=iz*.5;
  if(Math.hypot(x,z)>L.r-1)continue;
  const s=A.s(L,x,z);
  if(s<=1.1&&decTry(key,x,z,0,-1).ok)out.push({x,z,s})}
 out.sort((a,b)=>a.s-b.s);
 return out.slice(0,20)}
function decAddArea(key){
 const c=decAreaList(key);
 if(!c.length){setWhy("bad",`Khu ${areaOf(DEC.area).name} của đảo ${S.cur} không còn chỗ hợp lệ cho món này. Thử khu khác, hoặc cất bớt đồ chặn đường.`);return}
 decAdd(key,c[0].x,c[0].z,0)}

/* Khi chưa sửa gì, DEC.items là tấm gương của bố cục trên máy chủ: mỗi lần nhận view thì soi lại,
   nên đổi đảo hay mua đồ không bao giờ để nháp cũ treo trên cảnh. */
function decOpen(){DEC.items=decPlaced().map(p=>({item:p.item,x:p.x,z:p.z,rot:p.rot}));DEC.ver=decVer();
 DEC.hist=[];DEC.redo=[];DEC.sel=-1;DEC.pick=null;DEC.dirty=false;decSync3()}
function decCancel(){decOpen();setWhy("ok","✖ Đã bỏ bản nháp, đảo trở lại đúng bố cục đang lưu trên máy chủ.");render()}
function decSave(){
 if(!S.LIVE){msg("Trang chưa đọc được máy chủ — chưa lưu được.");return}
 /* một cú PUT duy nhất cho cả bản nháp; 409 (bản cũ / vượt số đã mua) thì nháp vẫn còn nguyên để sửa tiếp. */
 act("/api/islands/decor/layout",{island:S.cur,baseVersion:DEC.ver,items:DEC.items},()=>{
  decOpen();setWhy("ok",`💾 Đã lưu bố cục đảo ${S.cur} (phiên bản ${DEC.ver}): ${DEC.items.length} món. Ví không đổi — lưu bố cục không trừ xu.`);render()}, "PUT")}
function decBuy(key,qty){
 const it=IC.decorOf(key),cost=it.price*qty,locked=IC.itemLockedReason(it,S.islands);
 if(locked){msg(locked);return}
 if(S.coins<cost){msg(`Cần ${cost} xu cho ${qty}× ${it.icon} ${it.name}. Ví bạn có ${S.coins} xu — còn thiếu ${cost-S.coins}. Chưa có gì bị trừ.`);return}
 confirmBox(`Mua ${it.icon} ${it.name} ×${qty}`,`${cost} xu từ ví chung (cùng ví với bài học, trò chơi, thị trấn). Sau khi mua còn ${S.coins-cost} xu. Mua thì đồ nằm trong kho, muốn đặt hay cất bao nhiêu cũng được — cất về kho không mất đồ và không hoàn xu.`,
  ()=>act("/api/islands/decor/buy",{item:key,qty},(j)=>{msg(`🧾 Đã mua ${qty}× ${it.name} (−${cost} xu). Ví còn ${j.xu} xu — trừ đúng một lần.`)}));
}
/* Rời tab / sang đảo khi còn nháp: hỏi trước, không tự lưu. */
function withDecGuard(fn){
 if(!decDirty()){fn();return}
 confirmBox("Bản nháp trang trí chưa lưu",`Đảo ${S.cur} đang có ${DEC.items.length} món đặt nháp, chưa bấm Lưu. Rời khỏi đây thì nháp bị bỏ (đồ vẫn còn trong kho, không mất xu nào).`,
  ()=>{decCancel();fn()});
}
addEventListener("beforeunload",e=>{if(decDirty()){e.preventDefault();e.returnValue=""}});

/* ============ 5b. 🎨 D4 — PHONG CÁCH ĐẢO (4 nhánh, mở một lần cho cả tài khoản) ============ */
/* Khác với đồ trang trí: phong cách là "kiểu nhìn" của cả đảo (trời · giờ · cỏ · thời tiết), không chiếm
   chỗ đặt và không đụng layout_ver. buyStyle trừ xu ĐÚNG MỘT LẦN (style_buy), pickStyle/applyStyle giá 0,
   nên nút "Bật"/"Tắt" dưới đây không được chạm tới xu — chỉ nút Mua mới tiêu. */
const styCur=()=>(S.decor&&S.decor.styles&&S.decor.styles[S.cur])||{};
const styHas=k=>!!(S.decor&&Array.isArray(S.decor.styleOwned)&&S.decor.styleOwned.includes(k));
const KIND_LABEL={weather:"🌦️ Thời tiết",tod:"🕰️ Khóa giờ",grass:"🟩 Màu cỏ",sky:"☁️ Bầu trời"};
function styBuy(key){
 const s=IC.styleOf(key);if(!s)return;
 if(styHas(key)){setWhy("ok",`${s.icon} ${s.name} đã mở cho tài khoản này — bật ở đảo nào cũng được, không mất xu lần hai.`);return}
 if(S.coins<s.price){setWhy("bad",`Chưa mở được ${s.icon} ${s.name}: cần ${s.price} xu, ví bạn có ${S.coins} (thiếu ${s.price-S.coins}). Chưa có gì bị trừ.`);return}
 confirmBox(`Mở ${s.icon} ${s.name}`,`${s.price} xu MỘT LẦN cho cả tài khoản (chi style_buy). Mở rồi thì bật/tắt cho đảo nào cũng miễn phí, kể cả trả về mặc định. Sau khi mở còn ${S.coins-s.price} xu.`,
  ()=>act("/api/islands/style/buy",{style:key},(j)=>setWhy("ok",`🎫 Đã mở ${s.icon} ${s.name} (−${s.price} xu, ví còn ${j.xu}). Bấm "Bật" để dùng cho đảo ${S.cur}.`)));
}
/* Một nhánh mỗi cú POST; server chỉ trả về nhánh vừa nhắc tới nên ba nhánh còn lại giữ nguyên. */
function styPick(kind,key){
 const s=key?IC.styleOf(key):null;
 act("/api/islands/style",{island:S.cur,[kind]:key},
  ()=>setWhy("ok",s?`🎨 Đã bật ${s.icon} ${s.name} cho đảo ${S.cur} — miễn phí, phiên bản bố cục vẫn ${DEC.ver}.`
   :`🎨 Nhánh ${KIND_LABEL[kind]} của đảo ${S.cur} đã về mặc định (miễn phí).`));
}
function pStyle(){
 const cur=styCur(),owned=(S.decor&&S.decor.styleOwned)||[];
 const rest=IC.DECOR_STYLES.filter(s=>!styHas(s.k)).reduce((a,s)=>a+s.price,0);
 let h=`<h3>🎨 Phong cách đảo ${S.cur}${themeOf(S.cur).ic}</h3>
 <p class="mute">Bốn nhánh này đổi <b>cách nhìn cả đảo</b> (bầu trời, khóa giờ, màu cỏ, thời tiết) — không phải món đặt xuống đất,
 không chiếm chỗ trong ngân sách 40 món và <b>không làm phiên bản bố cục nhảy số</b>. Mỗi kiểu <b>mở một lần cho cả tài khoản</b>,
 sau đó bật · tắt · trả về mặc định cho từng đảo <b>miễn phí</b>.</p>
 <div class="grid" style="margin-top:0">
  <div class="item"><h3>Đã mở</h3><div class="mute">${owned.length}/${IC.DECOR_STYLES.length} kiểu · mở nốt cả bộ còn ${rest} xu</div>
   <div class="mute">Kho phong cách nằm ở tài khoản, không nằm theo đảo — sang đảo khác dùng lại không mất xu.</div></div>
  <div class="item"><h3>Đang dùng ở đảo này</h3>
   ${IC.STYLE_KINDS.map(k=>`<div class="mute">${KIND_LABEL[k]}: ${cur[k]?`${IC.styleOf(cur[k]).icon} ${IC.styleOf(cur[k]).name}`:"mặc định của đảo"}</div>`).join("")}</div></div>`;
 for(const kind of IC.STYLE_KINDS){
  h+=`<h3>${KIND_LABEL[kind]} — ${cur[kind]&&IC.styleOf(cur[kind])?`đang dùng ${IC.styleOf(cur[kind]).icon} ${IC.styleOf(cur[kind]).name}`:"mặc định của đảo"}</h3>`;
  if(cur[kind])h+=`<div class="ctl"><button data-sreset="${kind}">↩ Về mặc định của đảo (miễn phí)</button></div>`;
  h+=`<div class="grid">`;
  for(const s of IC.DECOR_STYLES.filter(i=>i.kind===kind)){
   const on=cur[kind]===s.k,has=styHas(s.k);
   h+=`<div class="item${on?" sel":""}"><h3>${s.icon} ${s.name}</h3>
    <div class="mute">${s.price} xu · ${kind}${on?" · ✅ đang bật ở đảo này":has?" · 🔓 đã mở":""}</div>
    <div class="ctl">
     ${has?`<button data-spick="${kind}:${s.k}" ${on?"disabled":"class=pri"}>${on?"Đang dùng":"Bật"}</button>`
        :`<button data-sbuy="${s.k}" ${S.coins>=s.price?"":"disabled"}>Mở ${s.price} xu</button>`}
    </div></div>`;
  }
  h+="</div>";
 }
 return h+`<p class="mute">Giá lấy từ <code>IslandCore.DECOR_STYLES</code> — cùng bảng giá <code>POST /api/islands/style/buy</code> dùng.
  Thời tiết (mưa · sương · tuyết · cánh hoa) là hạt nền chung cơ chế với hiệu ứng sẵn có, 🪫 Tiết kiệm hoặc <i>giảm chuyển động</i> thì không dựng.
  Sai nhánh hoặc khóa chưa mở, máy chủ trả về câu chữ riêng (400 · 409) và hiện đúng ở dòng trạng thái trên.</p>`;
}

function pDecor(){
 if(!S.LIVE)return`<h2>🎨 Trang trí</h2><p class="mute">Tab này đọc "đã mua gì, đang đặt gì" từ <code>GET /api/islands</code> — mở trang qua <code>http://localhost:3000</code> để dùng.</p>`;
 const d=S.decor,used=DEC.items.length;
 const nb=IC.blockCount(DEC.items),nf=IC.fxCount(DEC.items),nl=IC.landmarkCount(DEC.items);
 let h=`<h2>🎨 Trang trí đảo ${S.cur}${themeOf(S.cur).ic}</h2>
 <p class="mute">Mọi chỉnh sửa ở đây là <b>bản nháp trên máy bạn</b>: đặt · xoay · nhích · cất đều <b>không trừ xu</b>, chỉ nút <b>Mua</b> mới tiêu (và luôn qua hộp xác nhận). Bấm <b>Lưu</b> gửi đúng một cú <code>PUT /decor/layout</code>, <b>Hủy</b> bỏ tất cả. Cất về kho không hoàn xu nhưng cũng không mất đồ.</p>
 <div class="grid" style="margin-top:0">
  <div class="item"><h3>Ngân sách đảo này</h3><div class="mute">${used}/${LIM.maxTotal} món · ${nb}/${LIM.maxBlock} món chặn · ${nf}/${LIM.maxFx} hiệu ứng · ${nl}/${LIM.maxLandmark} công trình lớn</div>
   <div class="mute">Lưới ${LIM.grid} · ${LIM.rotSteps} hướng · cách ô đất thêm ${LIM.slotGap} · hai món chặn chừa lối ${LIM.gap}</div></div>
  <div class="item"><h3>Trạng thái</h3><div class="mute">${DEC.dirty?"🟡 chưa lưu":"🟢 đã lưu"} · phiên bản bố cục <b>${DEC.ver}</b></div>
   <div class="mute">Máy chủ giữ bản này để hai tab không đè nhau; lưu trúng bản cũ sẽ gặp 409 kèm hướng dẫn tải lại.</div></div></div>
 <div class="ctl">
  <button id="dSave" class="pri" ${DEC.dirty?"":"disabled"}>💾 Lưu bố cục (${used} món)</button>
  <button id="dCancel" ${DEC.dirty?"":"disabled"}>✖ Hủy nháp</button>
  <button id="dUndo" ${DEC.hist.length?"":"disabled"}>↶ Hoàn tác</button>
  <button id="dRedo" ${DEC.redo.length?"":"disabled"}>↷ Làm lại</button>
  <button id="dPerf">⏱ Đo khung hình (60)</button></div>
 <div id="decWhy" class="why ${DEC.whyKind||"ok"}" role="status" aria-live="polite">${DEC.why||"Chọn một món dưới đây rồi bấm Đặt (cầm lên, rê chuột hoặc chạm để xem bóng xanh/đỏ), hoặc thêm bằng bàn phím: Chọn khu vực → Thêm vào đảo."}</div>`;

 /* --- bàn sửa cho món đang chọn: chuột và bàn phím cùng một bộ nút --- */
 const sel=DEC.items[DEC.sel];
 h+=`<h3>Đang chọn</h3>${sel?`<div class="item sel"><h3>${IC.decorOf(sel.item).icon} ${IC.decorOf(sel.item).name} <small>(${IC.decorOf(sel.item).cls})</small></h3>
  <div class="mute">vị trí (${sel.x}, ${sel.z}) · hướng ${sel.rot*45}° · khu ${areaNameAt(sel.x,sel.z)}</div>
  <div class="ctl"><button id="dRot">↺ Xoay 45° (R)</button><button id="dStore">🗑 Cất vào kho (Delete)</button></div>
  <div class="pad">${[["↑",0,-.25],["←",-.25,0],["↓",0,.25],["→",.25,0]].map(p=>`<button data-nudge="${p[1]}:${p[2]}" aria-label="Nhích ${p[0]}">${p[0]}</button>`).join("")}</div>
  <div class="mute">Phím mũi tên cũng nhích 0,25 mỗi nhịp.</div></div>`
  :`<p class="mute">Chưa chọn món nào. Bấm vào món đã đặt trong cảnh 3D hoặc trong danh sách dưới đây.</p>`}`;

 /* --- danh sách chữ song song: bàn phím dùng được hết, không cần chuột --- */
 const grp={};for(const it of IC.DECOR_ALL)(grp[it.group]=grp[it.group]||[]).push(it);
 if(DEC.pick)h+=`<p class="mute">🖐 Đang cầm <b>${IC.decorOf(DEC.pick).icon} ${IC.decorOf(DEC.pick).name}</b> — bấm vào mặt đảo để đặt, hoặc bấm nút Đặt lần nữa để bỏ xuống.</p>`;
 h+=`<h3>Đồ đang đặt trên đảo này</h3>`;
 if(!used)h+=`<p class="mute">Chưa đặt gì. Đây là bản danh sách của cảnh 3D — dùng hoàn toàn bằng bàn phím hoặc trình đọc màn hình.</p>`;
 else h+=`<div class="grid">${DEC.items.map((p,i)=>{const it=IC.decorOf(p.item);
  return`<div class="item${i===DEC.sel?" sel":""}"><h3>${it.icon} ${it.name}</h3><div class="mute">${areaNameAt(p.x,p.z)} · (${p.x}, ${p.z}) · hướng ${p.rot*45}° · ${it.cls}</div>
   <div class="ctl"><button data-sel="${i}" aria-label="Chọn ${it.name}">Chọn</button><button data-store2="${i}" aria-label="Cất ${it.name} vào kho">🗑 Cất</button></div></div>`}).join("")}</div>`;
 h+=`<h3>Chọn khu vực rồi thêm bằng bàn phím</h3>
 <p class="mute">Không cần chuột: chọn <b>khu</b> bên dưới rồi bấm <b>Thêm vào đảo</b> ở một món — món sẽ nằm ở <b>chỗ trống hợp lệ gần tâm khu nhất</b> (quét lưới 0,5 ô một, vẫn bám ${LIM.grid} như mọi chỗ khác).</p>
 <div class="ctl">${AREAS.map(a=>`<button data-area="${a.k}" ${a.k===DEC.area?'class="pri"':""} aria-pressed="${a.k===DEC.area}">${a.ic} ${a.name}</button>`).join("")}</div>`;
 for(const name of Object.keys(grp)){
  h+=`<h3>${name}</h3><div class="grid">`;
  for(const it of grp[name]){
   const locked=IC.itemLockedReason(it,S.islands),left=decLeft(it.k),owned=+(d.owned[it.k]||0);
   h+=`<div class="item${locked?" locked":""}${DEC.pick===it.k?" pick":""}"><h3>${it.icon} ${it.name}</h3>
    <div class="mute">${it.price} xu · (${it.cls})${it.theme?" · gói "+it.theme.toUpperCase():""}${it.needDone?" · cần "+it.needDone+" đảo hoàn chỉnh":""}</div>
    <div class="mute">${locked?locked:`đã có ×${owned} · còn đặt được ×${left<0?0:left}`}</div>
    <div class="ctl">
     <button data-buy="${it.k}" ${S.coins>=it.price&&!locked?"":"disabled"}>Mua ${it.price} xu</button>
     <button data-hold="${it.k}" ${left>0&&!locked&&DEC.pick!==it.k?"":"disabled"}>${DEC.pick===it.k?"Bỏ xuống":"Đặt"}</button>
     <button data-addarea="${it.k}" ${left>0&&!locked?"":"disabled"}>Thêm vào đảo</button></div></div>`
  }
  h+="</div>";
 }
 h+=pStyle();
 return h+`<p class="mute">Gói theo chủ đề và công trình lớn hiển thị mờ cho tới khi mở được điều kiện (hoàn chỉnh một đảo cùng chủ đề; 1/2/4/8 đảo cho công trình lớn). Giá lấy nguyên từ <code>IslandCore.DECOR_*</code> — cùng bảng giá máy chủ dùng, không có con số viết tay ở giao diện.</p>`;
}
/* Khu của một điểm, dùng cho cả danh sách và nhãn: điểm nhỏ nhất ở khu nào thì gọi là khu đó. */
function areaNameAt(x,z){
 const L=genIsland(S.cur);
 let best=AREAS[0],bs=1e9;
 for(const A of AREAS){const s=A.s(L,x,z);if(s<bs){bs=s;best=A}}
 return best.name}
/* ============ 6. TỰ KIỂM TRA (hình ảnh + luật dựng từ seed — phần giá đã có test ở server) ============ */
function runChecks(){
 const out=[],add=(n,ok,d)=>out.push(`${ok?"✅":"❌"} ${n}${d?" — "+d:""}`);
 add("Giá do server giữ: đảo "+S.cur+" = "+S.islandCost+" xu",S.islandCost===IC.islandCost(S.cur),`hệ số ${S.factor.toFixed(2)}`);
 add(`${C.themes.length} chủ đề, mỗi chủ đề có 3 công trình riêng`,C.themes.every(t=>t.features.length===3));
 let same=true;for(let n=1;n<=13;n++)if(JSON.stringify(genIsland(n))!==JSON.stringify(genIsland(n)))same=false;
 add("Đảo n dựng từ seed luôn giống nhau (n=1…13)",same);
 let seen={};for(let n=1;n<=16;n++){const L=genIsland(n),sig=L.t+L.tod+L.r.toFixed(2);seen[sig]=1}
 add("16 đảo đầu không trùng nguyên bộ hình (chủ đề + giờ + bán kính)",Object.keys(seen).length>=12,Object.keys(seen).length+" kiểu khác nhau");
 const L=genIsland(7),R=rand(hash("walk-7"));let bad=0;
 for(let i=0;i<1e4;i++){const p=pickSpot(L,R);if(!walkable(L,p.x,p.z,.3))bad++}
 add("10.000 điểm đi bộ đều trong đảo và tránh nhà/cây/công trình",bad===0,bad+" điểm hỏng");
 add(`No bụng / Vui vẻ có sàn ${C.satietyFloor}`,IC.decay({satiety:100,mood:100,updatedAt:Date.now()-3600000*24*30},Date.now()).satiety===C.satietyFloor);
 const btns=[...document.querySelectorAll("button")].map((b)=>b.textContent).join(" · ");
 add("Không còn nút giả lập cộng xu",!/giả lập|\(\s*\+\s*\d+\s*xu/i.test(btns));
 /* 🎨 D3 (a): mọi món trong catalog phải dựng được mà không ném lỗi. */
 if(DEC3){let noMesh=[];
  for(const it of IC.DECOR_ALL){try{const g=DEC3.mesh(it);if(!g||!g.isObject3D)noMesh.push(it.k);
   else g.traverse(o=>{if(o.geometry)o.geometry.dispose()})}catch(e){noMesh.push(it.k)}}
  add(`Toàn bộ ${IC.DECOR_ALL.length} món trong catalog dựng hình được`,noMesh.length===0,noMesh.length?"hỏng: "+noMesh.join(", "):"kể cả 4 gói chủ đề và công trình lớn");
  /* 🎨 D3 (b): dựng đủ trần món chặn bằng canPlace thật, rồi cho thú đi 2.000 bước —
     không đích nào rơi vào vật cản và mặt đảo vẫn liền khối. */
  const L=genIsland(S.cur),R=rand(hash("decor-walk")),lay=[];
  for(let ix=Math.ceil(-L.r/.5);ix*.5<=L.r&&lay.length<LIM.maxBlock;ix++)
   for(let iz=Math.ceil(-L.r/.5);iz*.5<=L.r&&lay.length<LIM.maxBlock;iz++){
    const p={item:"bush",x:ix*.5,z:iz*.5,rot:0};
    if(IC.canPlace(L,lay,p.item,p.x,p.z,0,{slots:S.islands,baseFraction:decBase()}).ok)lay.push(p)}
  const blk=IC.blockersOf(L,lay);let inBad=0;
  for(let i=0;i<2000;i++){const p=pickSpot(L,R,0,0,blk);if(!walkable(L,p.x,p.z,.05,blk))inBad++}
  add(`Thú 2.000 bước giữa ${lay.length}/${LIM.maxBlock} món chặn`,lay.length===LIM.maxBlock&&inBad===0,
   `${lay.length} món · ${inBad} đích hỏng · ${(100*IC.walkFraction(L,lay)).toFixed(1)}% đảo còn đi được`);
  /* 🎨 D4 (c): nhánh "thời tiết" phải dựng đúng số hạt mà trang khai, và bằng 0 khi 🪫/giảm chuyển động. */
  const st=DEC3.stats(),wf=styCur().weather&&IC.styleOf(styCur().weather);
  const exp=(RM||S.eco)?0:(wf?{rain:60,snow:50,petals:45,fog:9}[wf.fx]||0:0);
  const got=Object.keys(st.kinds).reduce((a,k)=>a+(k.startsWith("w-")?st.kinds[k]:0),0);
  add(`Hạt thời tiết ${wf?wf.icon+" "+wf.name:"(mặc định, không hạt)"} = ${got} hạt`,got===exp,
   `tổng ${st.amb} hạt (nền + thời tiết) · ${(RM||S.eco)?"đang tắt vì "+(RM?"giảm chuyển động":"🪫 Tiết kiệm"):"chế độ đầy đủ"}`);
  /* 🎨 D4 (d): chạy thật 30 khung hình tính toán rồi so từng vị trí — đây là bằng chứng
     "bật giảm chuyển động thì ĐÓNG BĂNG TUYỆT đối", không phải "gần như đứng yên". */
  const fz=DEC3.freeze();
  add(RM?`Giảm chuyển động: ${fz.n} khung hình không làm vật nào nhúc nhích`
       :`Chế độ ${S.eco?"🪫 Tiết kiệm":"đầy đủ"}: ${fz.n} khung hình${fz.mv>0?" có chuyển động":" đứng yên — hạt đã tắt hết"}`,
   RM?fz.mv===0:(fz.amb>0?fz.mv>0:true),
   `${fz.mv.toFixed(2)} đơn vị / ${fz.pts} vật (thú + ${fz.amb} hạt + ${fz.dec} món) · ${RM?"RM bật":"RM tắt"}${fz.eco?" · 🪫":""}`)}
 else add("Toàn bộ catalog dựng hình được",true,"máy này không có WebGL — bỏ qua phần 3D, bảng chữ vẫn dùng đủ");
 /* 🎨 D4 (a): bảng phong cách — số kiểu, số nhánh và tổng giá phải đúng như lõi khai. */
 const kc={};const sum=IC.DECOR_STYLES.reduce((a,s)=>{kc[s.kind]=(kc[s.kind]||0)+1;return a+s.price},0);
 add(`${IC.DECOR_STYLES.length} phong cách trên ${IC.STYLE_KINDS.length} nhánh, tổng ${sum} xu`,
  IC.DECOR_STYLES.length===15&&sum===830&&IC.STYLE_KINDS.every(k=>kc[k]>0),
  IC.STYLE_KINDS.map(k=>`${k} ×${kc[k]}`).join(" · "));
 /* 🎨 D4 (b): mỗi kiểu phải có nút (Mở kèm đúng giá của lõi, hoặc Bật nếu đã mở) — không con số viết tay. */
 const tpl=document.createElement("div");tpl.innerHTML=pStyle();
 const miss=IC.DECOR_STYLES.filter(s=>{
  const b=tpl.querySelector(`[data-sbuy="${s.k}"],[data-spick="${s.kind}:${s.k}"]`);
  return !b||!b.closest(".item").textContent.includes(`${s.price} xu`)});
 add(`Bảng phong cách có nút cho ${IC.DECOR_STYLES.length} kiểu, giá đúng lõi`,miss.length===0,
  miss.length?"thiếu/sai giá: "+miss.map(s=>s.k).join(", "):`${IC.DECOR_STYLES.length} thẻ · ${tpl.querySelectorAll("[data-sbuy]").length} nút Mở · ${tpl.querySelectorAll("[data-spick]").length} nút Bật`);
 $("chk").innerHTML="<h2>Kết quả tự kiểm tra</h2>"+out.map(x=>`<div>${x}</div>`).join("");
 msg(`🧪 ${out.filter(x=>x[0]==="✅").length}/${out.length} mục đạt. ${out.some(x=>x[0]==="❌")?"Có mục hỏng — xem danh sách bên dưới.":"Hình đảo dựng đúng và trang chỉ tiêu xu."}`);
}
function decSelect(i){
 if(!DEC.items[i])return;
 const it=IC.decorOf(DEC.items[i].item);
 DEC.sel=i;DEC.pick=null;
 setWhy("ok",`Đang chọn ${it.icon} ${it.name} (hướng ${DEC.items[i].rot*45}°). ↺ xoay 45° · 4 mũi tên nhích 0,25 · 🗑 cất vào kho — chuột, chạm hay bàn phím đều được.`);
 render()}

/* ============ 7. CẢNH 3D ============ */
if(!window.THREE){$("err").hidden=false}
else try{
const T=D3.T,{mat,put,B,K,Sp,Ro}=D3,Cy=D3.Cy;
const shifc=(hex,hu,li)=>{const c=new T.Color(hex);c.offsetHSL(hu,0,li);return"#"+c.getHexString()};
const shiftPal=(c,hu,li)=>{const o={};for(const k in c)o[k]=k==="sea"||k==="sky"?c[k]:shifc(c[k],hu,li);return o};

/* ---- nhà theo chủ đề (3 cấp) ---- */
const HB={
 sakura(g,P,lv){if(lv===1){B(g,.7,.4,.6,P.wall,0,0,0);K(g,.66,.5,P.roof,0,.15,0,4).rotation.y=Math.PI/4}
  if(lv===2){B(g,1.15,.8,1,P.wall,0,0,0);Ro(g,1.4,.62,1.1,P.roof,0,.8,0);B(g,.25,.45,.06,P.wood,0,0,.51);[-.37,.37].forEach(x=>B(g,.2,.2,.06,P.glow,x,.3,.52,{emissive:P.glow,emissiveIntensity:.35}))}
  if(lv===3){B(g,1.5,1.05,1.2,P.wall,0,0,0);Ro(g,1.75,.72,1.3,P.roof,0,1.05,0);B(g,.72,.72,.75,P.wall,.98,0,.08);Ro(g,.9,.42,.85,P.roof,.98,.72,.08);B(g,.3,.55,.07,P.wood,-.1,0,.62);[-.5,.45].forEach(x=>B(g,.24,.26,.06,P.glow,x,.5,.63,{emissive:P.glow,emissiveIntensity:.35}));Cy(g,.1,.12,.9,P.stone,-.95,0,.7,10);Sp(g,.17,P.accent,-.95,1.05,.7)}},
 maple(g,P,lv){if(lv===1){B(g,.75,.5,.65,P.wall,0,0,0);K(g,.62,.45,P.roof,0,.2,0,4).rotation.y=Math.PI/4}
  if(lv===2){B(g,1.2,.85,1,P.wall,0,0,0);Ro(g,1.45,.65,1.1,P.roof,0,.85,0);B(g,.22,.7,.22,P.stone,.45,.75,-.3);B(g,.25,.45,.06,P.wood,0,0,.51);[-.38,.38].forEach(x=>B(g,.2,.2,.06,P.glow,x,.32,.52,{emissive:P.glow,emissiveIntensity:.4}))}
  if(lv===3){B(g,1.6,1.15,1.3,P.wall,0,0,0);Ro(g,1.9,.8,1.4,P.roof,0,1.15,0);B(g,.3,.9,.3,P.stone,.6,1.0,-.4);B(g,.32,.5,.07,P.wood,0,0,.66);[-.6,-.1,.5].forEach(x=>B(g,.22,.26,.06,P.glow,x,.55,.67,{emissive:P.glow,emissiveIntensity:.4}));B(g,.55,.5,.5,P.wood,-1.05,0,.15);Sp(g,.2,P.accent,-1.05,.6,.15)}},
 desert(g,P,lv){if(lv===1){Cy(g,.5,.55,.5,P.wall,0,0,0,10);K(g,.5,.35,P.roof,0,.5,0,10)}
  if(lv===2){Cy(g,.75,.8,.85,P.wall,0,0,0,12);K(g,.8,.5,P.roof,0,.85,0,12);B(g,.24,.4,.06,P.wood,0,0,.8);B(g,.3,.22,.06,P.glow,.45,.3,.6,{emissive:P.glow,emissiveIntensity:.3})}
  if(lv===3){B(g,1.5,.9,1.2,P.wall,0,0,0);for(let k=0;k<3;k++)Cy(g,.28,.3,.5,P.wall,-.5+k*.5,.9,.0,10);B(g,1.6,.08,.16,P.roof,0,.9,0);B(g,.3,.55,.07,P.wood,.1,0,.61);[-.5,.6].forEach(x=>B(g,.24,.24,.06,P.glow,x,.4,.62,{emissive:P.glow,emissiveIntensity:.3}));Cy(g,.08,.1,1.1,P.stone,-1.1,0,.5,8);Sp(g,.14,P.accent,-1.1,1.2,.5)}},
 ice(g,P,lv){if(lv===1){const e=put(g,new T.SphereGeometry(.62,12,8,0,6.283,0,1.4),mat(P.wall));e.position.y=.05}
  if(lv===2){const e=put(g,new T.SphereGeometry(.95,14,9,0,6.283,0,1.5),mat(P.wall,{roughness:.4}));e.position.y=.05;B(g,.3,.4,.5,P.wood,0,0,.75)}
  if(lv===3){const e=put(g,new T.SphereGeometry(1.25,16,10,0,6.283,0,1.5),mat(P.wall,{roughness:.35}));e.position.y=.05;B(g,.35,.5,.6,P.wood,0,0,.95);[0,1,2].forEach(k=>{const r=new T.Mesh(new T.TorusGeometry(.5+k*.35,.05,8,18),mat(P.stone));r.rotation.x=Math.PI/2;r.position.set(0,.35+k*.4,.0);g.add(r)});Sp(g,.1,P.glow,0,1.35,0,{emissive:P.glow,emissiveIntensity:.6})}},
 tropic(g,P,lv){if(lv===1){for(let k=0;k<4;k++)Cy(g,.06,.06,.5,P.wood,k?.5:-.5,0,k>1?.35:-.35,6);B(g,1,.08,.8,P.wall,0,.5,0)}
  if(lv===2){for(let k=0;k<6;k++)Cy(g,.07,.07,.8,P.wood,(k%3-1)*.55,0,(k>2?1:-1)*.4,6);B(g,1.4,.12,1.1,P.wall,0,.8,0);B(g,1.1,.55,.85,P.wall,0,.92,0);Ro(g,1.5,.5,1.1,P.roof,0,1.47,0);B(g,.24,.4,.06,P.wood,0,.92,.45)}
  if(lv===3){for(let k=0;k<9;k++)Cy(g,.08,.08,1.1,P.wood,((k%3)-1)*.62,0,((k>5?1:k>2?-1:0))*.5,6);B(g,1.9,.14,1.4,P.wall,0,1.1,0);B(g,1.6,.75,1.15,P.wall,0,1.24,0);Ro(g,2.1,.6,1.4,P.roof,0,1.99,0);[-.55,.55].forEach(x=>B(g,.26,.3,.06,P.glow,x,1.4,.6,{emissive:P.glow,emissiveIntensity:.35}));B(g,.3,.5,.07,P.wood,0,1.15,.6);Cy(g,.5,.55,.12,P.leaf,-1.4,0,.5,10)}},
 cloud(g,P,lv){if(lv===1){Cy(g,.5,.55,.45,P.wall,0,0,0,12);K(g,.55,.4,P.roof,0,.45,0,12)}
  if(lv===2){const e=put(g,new T.SphereGeometry(.85,16,10),mat(P.wall));e.position.y=.5;e.scale.set(1,.8,1);B(g,.28,.42,.06,P.wood,0,.2,.78);K(g,.35,.5,P.roof,0,1.25,0,10)}
  if(lv===3){const e=put(g,new T.SphereGeometry(1.2,18,12),mat(P.wall));e.position.y=.7;e.scale.set(1.1,.9,1.1);B(g,.32,.5,.07,P.wood,0,.35,1.05);[-.6,.6].forEach(x=>{const w=Sp(g,.18,P.glow,x,.9,1.0);w.material=mat(P.glow,{emissive:P.glow,emissiveIntensity:.4})});K(g,.45,.6,P.roof,0,1.8,0,12);Cy(g,.06,.06,.5,P.metal,0,2.3,0,8);Sp(g,.12,P.accent,0,2.6,0,{emissive:P.accent,emissiveIntensity:.4})}},
 ocean(g,P,lv){if(lv===1){const s=put(g,new T.SphereGeometry(.6,14,10),mat(P.wall));s.scale.set(1,.85,.8);K(g,.4,.4,P.roof,0,.5,-.3,8)}
  if(lv===2){const s=put(g,new T.SphereGeometry(.95,16,12),mat(P.wall));s.scale.set(1.05,.95,.9);for(let k=0;k<4;k++)K(g,.2,.5,P.roof,-.5+k*.34,.6,.55,8);B(g,.28,.45,.06,P.wood,0,0,.85);Sp(g,.14,P.glow,.5,.7,.5,{emissive:P.glow,emissiveIntensity:.4})}
  if(lv===3){const s=put(g,new T.SphereGeometry(1.3,18,12),mat(P.wall));s.scale.set(1.15,1.05,1.0);for(let k=0;k<6;k++){const a=k/6*6.283;K(g,.22,.62,P.roof,Math.cos(a)*.75,.8,Math.sin(a)*.75,8)}Cy(g,.5,.7,.3,P.roof,0,1.3,0,14);B(g,.32,.55,.07,P.wood,0,0,1.1);[-.55,.55].forEach(x=>Sp(g,.15,P.glow,x,.75,1.0,{emissive:P.glow,emissiveIntensity:.5}))}},
 firefly(g,P,lv){if(lv===1){Cy(g,.45,.5,.4,P.wall,0,0,0,10);Sp(g,.55,P.roof,0,.45,0).scale.set(1,.6,1)}
  if(lv===2){Cy(g,.55,.65,.8,P.wall,0,0,0,12);Sp(g,.9,P.roof,0,.8,0).scale.set(1,.62,1);[-.3,.3].forEach(x=>B(g,.16,.2,.05,P.glow,x,.35,.6,{emissive:P.glow,emissiveIntensity:.5}));for(let k=0;k<4;k++)Sp(g,.1,P.glow,(k%2?1:-1)*.6,.5+k*.1,(k>1?1:-1)*.5,{emissive:P.glow,emissiveIntensity:.7})}
  if(lv===3){Cy(g,.7,.9,1.2,P.wall,0,0,0,14);Sp(g,1.25,P.roof,0,1.2,0).scale.set(1,.6,1);[-.4,.4].forEach(x=>B(g,.2,.28,.06,P.glow,x,.5,.72,{emissive:P.glow,emissiveIntensity:.5}));B(g,.26,.5,.06,P.wood,0,0,.86);for(let k=0;k<7;k++){const a=k/7*6.283;Sp(g,.13,P.glow,Math.cos(a)*.95,1.55,Math.sin(a)*.95,{emissive:P.glow,emissiveIntensity:.7})}}}
};
/* ---- cây theo chủ đề ---- */
const TB={
 sakura(g,P,lv){const s=.6+lv*.45;Cy(g,.12*s,.16*s,1.1*s,P.trunk,0,0,0,10);for(let k=0;k<3;k++)Sp(g,(.62-.12*k)*s,P.leaf,k?.35*s*(k%2?1:-1):0,1.0*s+k*.34*s,k>1?-.3*s:0);Sp(g,.3*s,P.leaf2,-.3*s,1.25*s,.3*s)},
 maple(g,P,lv){const s=.6+lv*.45;Cy(g,.13*s,.17*s,1.2*s,P.trunk,0,0,0,10);K(g,.85*s,1.0*s,P.leaf,0,1.0*s,0,9);K(g,.62*s,.85*s,P.leaf2,0,1.55*s,0,9);[-1,1].forEach(k=>K(g,.4*s,.6*s,P.leaf,k*.6*s,.9*s,k*.2*s,8))},
 palm(g,P,lv){const s=.6+lv*.45;for(let k=0;k<4;k++)Cy(g,.09*s,.11*s,.7*s,P.trunk,0,.55*k*s,0,8);Sp(g,.22*s,P.wall,0,2.0*s,0);for(let k=0;k<6;k++){const a=k/6*6.283;const l=Sp(g,.5*s,P.leaf,Math.cos(a)*.5*s,2.05*s,Math.sin(a)*.5*s);l.scale.set(1.5,.16,.5);l.rotation.y=-a}for(let k=0;k<2;k++)Sp(g,.08*s,P.trunk,.15*s,1.95*s,k?.15:-.15)},
 pine(g,P,lv){const s=.6+lv*.45;Cy(g,.1*s,.13*s,.6*s,P.trunk,0,0,0,8);K(g,.8*s,1.0*s,P.leaf,0,.5*s,0,9);K(g,.6*s,.85*s,P.leaf,0,1.1*s,0,9);K(g,.4*s,.7*s,P.leaf,0,1.65*s,0,9);for(let k=0;k<3;k++)Sp(g,.16*s,P.leaf2,(k-1)*.4*s,1.0-k*.3*s,.35*s)},
 coconut(g,P,lv){const s=.6+lv*.45;for(let k=0;k<5;k++)Cy(g,.1*s,.12*s,.5*s,P.trunk,0,.45*k*s,k*.03*s,8);Sp(g,.26*s,P.wall,0,2.15*s,.05*s);for(let k=0;k<7;k++){const a=k/7*6.283;const l=Sp(g,.58*s,P.leaf,Math.cos(a)*.55*s,2.2*s,Math.sin(a)*.55*s);l.scale.set(1.6,.14,.45);l.rotation.y=-a}for(let k=0;k<3;k++)Sp(g,.11*s,P.trunk,Math.cos(k*2)*.18*s,2.0*s,Math.sin(k*2)*.18*s)},
 crystal(g,P,lv){const s=.6+lv*.45;Cy(g,.14*s,.2*s,.7*s,P.stone,0,0,0,6);for(let k=0;k<5;k++){const a=k/5*6.283;const c=K(g,.16*s,.9*s,P.leaf,Math.cos(a)*.28*s,.5*s,Math.sin(a)*.28*s,6,{emissive:P.glow,emissiveIntensity:.35});c.rotation.z=Math.cos(a)*.35;c.rotation.x=-Math.sin(a)*.35}K(g,.24*s,1.1*s,P.leaf2,0,.9*s,0,6,{emissive:P.glow,emissiveIntensity:.4})},
 coral(g,P,lv){const s=.6+lv*.45;Cy(g,.2*s,.3*s,.8*s,P.wall,0,0,0,8);for(let k=0;k<6;k++){const a=k/6*6.283;const r=Cy(g,.06*s,.1*s,.9*s,P.leaf,Math.cos(a)*.3*s,.7*s,Math.sin(a)*.3*s,7);r.rotation.z=Math.cos(a)*.4;r.rotation.x=-Math.sin(a)*.4;Sp(g,.12*s,P.leaf2,r.position.x,.7*s+r.position.y*.7,r.position.z)}for(let k=0;k<3;k++)Sp(g,.1*s,P.accent,(k-1)*.3*s,1.3*s,.2*s,{emissive:P.glow,emissiveIntensity:.4})},
 moss(g,P,lv){const s=.6+lv*.45;Cy(g,.22*s,.32*s,1.1*s,P.trunk,0,0,0,10);K(g,1.0*s,.9*s,P.leaf,0,1.05*s,0,10);K(g,.75*s,.75*s,P.leaf2,0,1.55*s,0,10);for(let k=0;k<5;k++){const a=k/5*6.283;Sp(g,.1*s,P.glow,Math.cos(a)*.7*s,.95,Math.sin(a)*.7*s,{emissive:P.glow,emissiveIntensity:.8})}Sp(g,.3*s,P.leaf,-.6*s,.3*s,.4*s)}
};
/* ---- 24 công trình riêng (3 cấp mỗi cái) ---- */
const FN={
 torii(g,P,lv){const h=.7+lv*.5,w=.7+lv*.45;for(let k=0;k<2;k++)Cy(g,.09,.1,h,P.accent,(k?1:-1)*w,0,0,8);B(g,w*2+.3,.12,.16,P.accent,0,h*.85,0);if(lv>1)B(g,w*2+.6,.1,.18,P.roof,0,h+0.05,0);if(lv>2){B(g,.5,.16,.1,P.wood,0,h*.55,0);Cy(g,.2,.2,.1,P.stone,0,0,w+.3,10);Cy(g,.2,.2,.1,P.stone,0,0,-w-.3,10)}},
 koi(g,P,lv){const r=.9+lv*.5;const w=Cy(g,r,r,.16,P.water,0,-.02,0,26,{roughness:.15,emissive:"#2a7fa8",emissiveIntensity:.25});if(lv>1)for(let k=0;k<lv;k++){const a=k*2.1;Sp(g,.12,k%2?"#e5484d":"#fff",Math.cos(a)*r*.6,.05,Math.sin(a)*r*.6)}if(lv>2){Cy(g,.3,.35,.2,P.stone,r*.5,0,-r*.4,10);Sp(g,.1,P.leaf,r*.5,.3,-r*.4)}},
 lantern(g,P,lv){const h=.7+lv*.35;Cy(g,.16,.22,.18,P.stone,0,0,0,10);Cy(g,.06,.06,h,P.stone,0,.18,0,8);const b=Sp(g,.22+lv*.03,P.glow,0,h+.2,0,{emissive:P.glow,emissiveIntensity:.7});K(g,.3,.25,P.stone,0,h+.4,0,8);if(lv>2){Cy(g,.14,.14,.14,P.glow,-.7,.7,0,8).material=mat(P.glow,{emissive:P.glow,emissiveIntensity:.6});Cy(g,.14,.14,.14,P.glow,.7,.7,0,8).material=mat(P.glow,{emissive:P.glow,emissiveIntensity:.6})}},
 windmill(g,P,lv){const h=1.1+lv*.6;Cy(g,.35,.5,h,P.wall,0,0,0,12);K(g,.5,.45,P.roof,0,h,0,10);if(lv>1)for(let k=0;k<4;k++){const a=k/4*6.283;B(g,.1,.9,.06,P.wood,Math.cos(a)*.45,h*.85,Math.sin(a)*.45).rotation.z=a}if(lv>2){Cy(g,.08,.08,.14,P.metal,0,h*.85,.6,8);B(g,.4,.3,.05,P.wood,0,0,.52)}},
 leafpile(g,P,lv){for(let k=0;k<3+lv*2;k++){const a=k*2.4,d=.15+lv*.12*(k%3);Sp(g,.14+ (k%3)*.03,k%2?P.leaf:P.leaf2,Math.cos(a)*d,.1+(k%3)*.06,Math.sin(a)*d).scale.set(1.3,.5,1)}if(lv>2)Sp(g,.2,P.accent,0,.4,0).scale.set(1.2,.4,1.2)},
 firepit(g,P,lv){Cy(g,.5+lv*.08,.55+lv*.08,.16,P.stone,0,0,0,16);if(lv>1)for(let k=0;k<5;k++){const a=k/5*6.283;Cy(g,.05,.05,.5,P.wood,Math.cos(a)*.3,.1,Math.sin(a)*.3,6).rotation.z=Math.cos(a)*.5}if(lv>2){const f=K(g,.22,.55,P.accent,0,.15,0,8,{emissive:P.glow,emissiveIntensity:.9});Sp(g,.12,P.glow,0,.45,0,{emissive:P.glow,emissiveIntensity:.9})}},
 well(g,P,lv){Cy(g,.55,.6,.6+lv*.1,P.stone,0,0,0,14);if(lv>1){Cy(g,.05,.05,.7,P.wood,-.5,.6,0,6);Cy(g,.05,.05,.7,P.wood,.5,.6,0,6);B(g,1.2,.08,.7,P.roof,0,1.3,0)}if(lv>2){Cy(g,.06,.06,.4,P.wood,0,.9,0);Sp(g,.1,P.metal,0,.75,.35,{metalness:.5})}},
 tent(g,P,lv){const s=.7+lv*.35;const t=put(g,new T.ConeGeometry(s,s*1.2,8),mat(P.accent));t.position.y=s*.6;t.rotation.z=.2;Cy(g,s,.95*s,.08,P.sand,0,0,0,12);if(lv>1)B(g,.18,.4,.05,P.wood,0,0,s*.9);if(lv>2){Sp(g,.12,P.metal,s,0,s*.6,{metalness:.4});Cy(g,.04,.04,1.1,P.wood,-s,0,0,6);B(g,.3,.2,.02,P.glow,-s,1.0,0)}},
 cactus(g,P,lv){Cy(g,.2,.24,.9+lv*.4,P.leaf,0,0,0,10);if(lv>1){Cy(g,.11,.12,.45,P.leaf,-.35,.4,0,8).rotation.z=.5;Cy(g,.1,.11,.35,P.leaf,.3,.55,0,8).rotation.z=-.5}if(lv>2){for(let k=0;k<4;k++){const a=k*1.6;Sp(g,.09,P.accent,Math.cos(a)*.2,.9+k*.05,Math.sin(a)*.2,{emissive:P.accent,emissiveIntensity:.3})}Cy(g,.3,.34,.1,P.sand,0,0,0,12)}},
 snowman(g,P,lv){Sp(g,.45,P.wall,0,.45,0);if(lv>1)Sp(g,.32,P.wall,0,1.05,0);if(lv>2){Sp(g,.2,P.wall,0,1.5,0);[-1,1].forEach(k=>{Cy(g,.03,.03,.5,P.wood,k*.45,1.0,0,6).rotation.z=k*1.1;Sp(g,.05,"#241d17",k*.07,1.55,.17)});K(g,.16,.3,P.accent,0,1.68,0,8);for(let k=0;k<3;k++)Sp(g,.05,"#241d17",0,1.0-k*.2,.3)}},
 icelake(g,P,lv){const r=1.0+lv*.55;Cy(g,r,r,.1,P.water,0,-.02,0,28,{roughness:.1,emissive:"#7fd8ea",emissiveIntensity:.4});if(lv>1)for(let k=0;k<3;k++){const a=k*2.2;const s=put(g,new T.OctahedronGeometry(.16),mat(P.wall,{roughness:.3}));s.position.set(Math.cos(a)*r*.5,.1,Math.sin(a)*r*.5)}if(lv>2){Cy(g,.2,.2,.5,P.wood,r*.4,.05,-r*.3,8);K(g,.3,.5,P.leaf,r*.4,.5,-r*.3,8)}},
 aurora(g,P,lv){const h=1.2+lv*.5;Cy(g,.08,.1,h,P.metal,0,0,0,8);Sp(g,.2,P.glow,0,h+.15,0,{emissive:P.glow,emissiveIntensity:.9});if(lv>1)for(let k=0;k<3;k++){const a=new T.Mesh(new T.TorusGeometry(.5+k*.2,.05,8,16,2.1),mat(["#6fe39a","#4a7de0","#c17de0"][k],{emissive:["#6fe39a","#4a7de0","#c17de0"][k],emissiveIntensity:.8}));a.position.set(0,h*.6+k*.25,-.4);a.rotation.y=.4;g.add(a)}if(lv>2){Cy(g,.06,.06,.8,P.metal,-.7,0,.3,6);Sp(g,.14,P.glow,-.7,.9,.3,{emissive:P.glow,emissiveIntensity:.9})}},
 waterfall(g,P,lv){const h=1+lv*.6;for(let k=0;k<3;k++)Sp(g,.5+lv*.15,P.stone,(k-1)*.7,.2,h*.35).scale.set(1,.7,1);if(lv>1)B(g,.5,h*.8,.06,P.water,0,0,-h*.3,{emissive:"#7fd8ea",emissiveIntensity:.5});Cy(g,.8+lv*.2,.9+lv*.2,.14,P.water,0,-.05,h*.45,22,{roughness:.1,emissive:"#2a7fa8",emissiveIntensity:.25});if(lv>2){Cy(g,.08,.08,.5,P.wood,-1,.5,h*.2,6);K(g,.3,.5,P.leaf,-1,.9,h*.2,8)}},
 bridge(g,P,lv){const l=1.2+lv*.7;B(g,l,.1,.55,P.wood,0,.35,0);for(let k=0;k<5;k++)Cy(g,.05,.05,.45,P.wood,-l/2+k*l/4,0,0,6);if(lv>1)for(let s=-1;s<2;s+=2){Cy(g,.05,.05,.55,P.wood,-l/2,.45,s*.26,6);Cy(g,.05,.05,.55,P.wood,l/2,.45,s*.26,6);B(g,l,.06,.05,P.wood,0,.9,s*.26)}if(lv>2){Cy(g,.5,.55,.16,P.water,0,-.02,0,20);for(let k=0;k<3;k++)B(g,.1,.04,.4,P.leaf2,-l/3+k*l/3,.42,0)}},
 boat(g,P,lv){const h=put(g,new T.CylinderGeometry(.45*lv+.3,.3,.3,10,1,false,0,3.14),mat(P.wood));h.rotation.y=Math.PI/2;h.scale.set(1.4,.7,1);if(lv>1){Cy(g,.05,.05,1.0,P.wood,0,.3,0,6);const s=put(g,new T.BoxGeometry(.02,.7,.5),mat(P.wall));s.position.set(0,.85,.14)}if(lv>2){B(g,.7,.06,.4,P.wood,0,.05,0);Sp(g,.12,P.accent,.3,.15,0);Cy(g,.1,.1,.2,P.metal,-.3,.1,0,8,{metalness:.4})}},
 rainbow(g,P,lv){const cols=["#e5484d","#f2b34a","#58b368","#4a7de0","#9b6bd6"];for(let k=0;k<clamp(lv+2,2,5);k++){const a=new T.Mesh(new T.TorusGeometry(1.1-k*.11,.07,8,22,3.14),mat(cols[k],{emissive:cols[k],emissiveIntensity:.35}));a.position.y=.05;g.add(a)}if(lv>2){Sp(g,.2,P.wall,-1.1,.1,0);Sp(g,.2,P.wall,1.1,.1,0)}},
 balloon(g,P,lv){const s=Sp(g,.45+lv*.1,P.accent,0,1.2+lv*.5,0);s.scale.set(1,1.2,1);if(lv>1){for(let k=0;k<3;k++)B(g,.5,.06,.06,k%2?P.wall:P.leaf2,0,1.0+k*.45,0);Cy(g,.02,.02,.8,P.wood,0,.5,0,6);B(g,.35,.2,.35,P.wood,0,.1,0)}if(lv>2){const c=new T.Mesh(new T.TorusGeometry(.5,.05,8,14),mat(P.metal,{metalness:.5}));c.rotation.x=Math.PI/2;c.position.y=1.35;g.add(c)}},
 windcloud(g,P,lv){for(let k=0;k<2+lv;k++)Sp(g,.35,P.wall,(k-(1+lv)/2)*.45,.8+lv*.25,(k%2?.2:-.2)).scale.set(1.3,.8,1);Cy(g,.1,.12,1.0+lv*.4,P.wall,0,0,0,10);if(lv>1)for(let k=0;k<4;k++){const a=k/4*6.283;B(g,.5,.05,.08,P.roof,Math.cos(a)*.45,.9+lv*.4,Math.sin(a)*.45).rotation.y=-a}if(lv>2){Cy(g,.06,.06,.2,P.metal,0,1.5+lv*.4,0,6)}},
 seaweed(g,P,lv){for(let k=0;k<2+lv*2;k++){const a=k*1.9,d=.2+(k%3)*.3;const s=Cy(g,.05,.09,.5+lv*.35,k%2?P.leaf:P.leaf2,Math.cos(a)*d,0,Math.sin(a)*d,7);s.rotation.z=Math.cos(a)*.25;s.rotation.x=-Math.sin(a)*.25}if(lv>2){Cy(g,.9,1,.1,P.water,0,-.02,0,20,{roughness:.15});Sp(g,.1,P.accent,.4,.35,.2,{emissive:P.accent,emissiveIntensity:.5})}},
 school(g,P,lv){for(let k=0;k<2+lv*2;k++){const a=k/ (2+lv*2)*6.283,d=.5+lv*.25;const b=Sp(g,.11,k%2?P.metal:P.accent,Math.cos(a)*d,.25+Math.sin(k)*.1,Math.sin(a)*d);b.scale.set(1,.8,1.5);b.rotation.y=-a;if(lv>2)B(g,.05,.03,.12,P.wall,Math.cos(a)*d-.14,.26,Math.sin(a)*d)}if(lv>1)Cy(g,.75,.8,.08,P.water,0,.02,0,20,{roughness:.1})},
 chest(g,P,lv){B(g,.8,.45,.55,P.wood,0,0,0);K(g,.42,.3,.55,P.metal,0,.45,0,10).rotation.y=Math.PI/2;if(lv>1){B(g,.85,.06,.06,P.metal,0,.4,0);Sp(g,.07,P.accent,0,.3,.29,{emissive:P.accent,emissiveIntensity:.5})}if(lv>2){for(let k=0;k<5;k++)Sp(g,.08,P.metal,(k-2)*.15,.55,(k%2?-.1:.1),{emissive:"#ffe9a8",emissiveIntensity:.7});Cy(g,.3,.35,.1,P.stone,0,0,.5,10)}},
 glowshroom(g,P,lv){for(let k=0;k<1+lv;k++){const a=k*2.3,d=k?.4:0,x=Math.cos(a)*d,z=Math.sin(a)*d,h=.3+k*.12;Cy(g,.08,.1,h,P.wall,x,0,z,8);Sp(g,.22+k*.05,P.leaf2,x,h, z,{emissive:P.glow,emissiveIntensity:.75}).scale.set(1,.6,1)}if(lv>2)for(let k=0;k<4;k++)Sp(g,.05,P.glow,(k-1.5)*.3,.7,(k%2?.3:-.3),{emissive:P.glow,emissiveIntensity:1})},
 starpond(g,P,lv){const h=.8+lv*.3;Cy(g,.1,.14,h,P.wood,0,0,0,8);B(g,.5,.06,.06,P.wood,0,h,.1);if(lv>1){Sp(g,.16,P.glow,0,h+.1,.1,{emissive:P.glow,emissiveIntensity:.9});K(g,.24,.3,P.roof,0,h+.35,.1,6)}if(lv>2){Cy(g,.5,.55,.1,P.stone,0,0,.55,14);Sp(g,.1,P.glow,-.4,1.0,-.3,{emissive:P.glow,emissiveIntensity:.9});Sp(g,.08,P.glow,.5,.85,-.5,{emissive:P.glow,emissiveIntensity:.9})}},
 observatory(g,P,lv){const h=1+lv*.5;Cy(g,.5,.6,h,P.stone,0,0,0,14);if(lv>1){const d=put(g,new T.SphereGeometry(.55,14,10,0,6.283,0,1.57),mat(P.wall));d.position.y=h;B(g,.14,.14,.6,P.metal,0,h+.2,.3).rotation.x=-.4}if(lv>2){Cy(g,.62,.62,.08,P.metal,0,h+.6,0,14);for(let k=0;k<4;k++){const a=k/4*6.283;Cy(g,.06,.06,.4,P.metal,Math.cos(a)*.5,h+.8,Math.sin(a)*.5,6)}Sp(g,.1,P.glow,0,h+1.1,0,{emissive:P.glow,emissiveIntensity:.8})}}
};
/* ---- dựng thú từ bộ tham số giống ---- */
function petMesh(b,fl){
 const g=new T.Group(),u=g.userData,s=b.size,eye=[],leg=[];
 Sp(g,.3*s,b.body,0,.3*s,-.04*s).scale.set(1.3,1.0,.92);
 Sp(g,.2*s,b.white,0,.26*s,.16*s).scale.set(1.05,.85,.6);
 const head=Sp(g,.18*s,b.body,0,.46*s,.22*s);u.head=head;
 Sp(g,.075*s*(1+b.muzzle),b.white,0,.42*s,.36*s).scale.set(.95,.75,1+b.muzzle*1.3);
 Sp(g,.02*s,"#241d17",-.07*s,.49*s,.36*s);eye.push(Sp(g,.02*s,"#241d17",.07*s,.49*s,.36*s),Sp(g,.02*s,"#241d17",-.07*s,.49*s,.36*s));
 Sp(g,.016*s,"#e0607a",0,.435*s,.4*s);
 [-1,1].forEach(k=>{
  if(b.ear==="sharp")K(g,.055*s,.16*s,b.dark,k*.1*s,.56*s,.18*s,6);
  else if(b.ear==="up"){const e=B(g,.05*s,.17*s,.035*s,b.dark,k*.11*s,.55*s,.16*s);e.rotation.z=k*.25}
  else{const e=Sp(g,.055*s,b.dark,k*.15*s,.5*s,.14*s);e.scale.set(.45,1.6,.5);e.rotation.z=k*.6}});
 if(b.tail==="long"){const t=Cy(g,.028*s,.05*s,.36*s,b.body,0,.3*s,-.34*s,8);t.rotation.x=-1.0;u.tail=t}
 else if(b.tail==="curl"){const t=new T.Mesh(new T.TorusGeometry(.1*s,.032*s,8,14),mat(b.dark));t.position.set(0,.38*s,-.3*s);t.rotation.x=1;g.add(t);u.tail=t}
 else{const t=Sp(g,.11*s,b.body,0,.36*s,-.32*s);t.scale.set(1,1.1,1);u.tail=t}
 [[-.13,.16],[.13,.16],[-.13,-.2],[.13,-.2]].forEach(p=>{const lg=new T.Group();lg.position.set(p[0]*s,.28*s,p[1]*s);Cy(lg,.032*s,.026*s,.28*s,b.dark,0,-.28*s,0,7);g.add(lg);leg.push(lg)});
 u.leg=leg;u.eye=eye;
 if(b.pat==="stripes")for(let k=0;k<3;k++)B(g,.055*s,.03*s,.2*s,b.dark,0,.45*s,(-.02-k*.11)*s);
 if(b.pat==="spots")[[-.1,.06],[.09,-.05],[0,-.2]].forEach(p=>Sp(g,.045*s,b.dark,p[0]*s,.34*s,p[1]*s).scale.set(1,.4,1));
 if(b.pat==="patch"){Sp(g,.14*s,b.dark,-.1*s,.32*s,.02*s).scale.set(1,1,.6);Sp(g,.09*s,b.white,.12*s,.2*s,.12*s).scale.set(1,.9,.7)}
 if(b.pat==="points"){K(g,.06*s,.15*s,b.dark,-.11*s,.56*s,.18*s,6);K(g,.06*s,.15*s,b.dark,.11*s,.56*s,.18*s,6);Sp(g,.07*s,b.dark,0,.44*s,.34*s);Cy(g,.03*s,.04*s,.3*s,b.dark,0,.3*s,-.34*s,8)}
 if(b.pat==="curl")for(let k=0;k<5;k++)Sp(g,.11*s,b.body,((k%3)-1)*.14*s,.3*s+((k>2)?.12:0)*s,(k%2?.14:-.14)*s);
 if(b.pat==="glow"){u.glow=[];for(let k=0;k<4;k++){const a=k*1.6;u.glow.push(Sp(g,.038*s,b.white,Math.cos(a)*.16*s,.36*s,Math.sin(a)*.16*s,{emissive:"#fff6c8",emissiveIntensity:.9}))}}
 if(fl>=3){const c=new T.Mesh(new T.TorusGeometry(.13*s,.022*s,8,16),mat("#e5484d"));c.position.set(0,.33*s,.19*s);c.rotation.x=1.5;g.add(c)}
 if(fl>=5){[-1,1].forEach(k=>{const w=K(g,.05*s,.09*s,"#f2b34a",k*.1*s,.62*s,.1*s,6);w.rotation.z=k*1.57});Sp(g,.03*s,"#e5484d",0,.62*s,.1*s)}
 if(fl>=7)K(g,.1*s,.16*s,"#4a7de0",0,.66*s,.22*s,8);
 g.scale.setScalar(.62+.42*b.size/.7);
 return g;
}
/* ---- cảnh nền ---- */
const cv=$("cv"),view=$("view");
const stage=D3.stage({canvas:cv,view,shadow:16,far:70,camFar:240,water:400,wy:-1.4});
const {renderer,scene,cam,hemi,sun,pool:water}=stage;
const world=new T.Group();scene.add(world);
const amb=new T.Group();scene.add(amb);
const petRoot=new T.Group();scene.add(petRoot);
const LB=D3.labels($("labs"),view),mkLab=LB.mk;
const TODS=[{sky:"#cfe9ff",sun:1.0,hemi:.85},{sky:"#bfe3f5",sun:1.05,hemi:.9},{sky:"#ffb88c",sun:.8,hemi:.62},{sky:"#101a2e",sun:.32,hemi:.3}];
const jit=(geo,L,k)=>{const p=geo.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),y=p.getY(i),r=Math.hypot(x,z);if(r<.2)continue;const a=Math.atan2(z,x),f=k*edgeOf(L,a)/r;p.setX(i,x*f);p.setZ(i,z*f)}geo.computeVertexNormals();return geo};
function clearGroup(g){
 D3.disposeGroup(g);
 if(g===world){SLOT.length=0;LB.clear();bowl.g=null;ball.g=null}
 if(g===amb)AMBP.length=0;
}
function clearPets(){for(const a of AGENTS){a.g.traverse(o=>{if(o.geometry)o.geometry.dispose()});petRoot.remove(a.g);a.lab.remove()}AGENTS.length=0;syncAgents.sig=""}
const SLOT=[],AMBP=[],AGENTS=[];
/* decoRoot đứng NGOÀI world: clearGroup(world) khỏi gỡ nhầm đồ trang trí, còn hit() thì thử riêng nó. */
const decoRoot=new T.Group();scene.add(decoRoot);
/* BLK = mấy món chặn đường đang đặt trên đảo này (island-core blockersOf) — thú đi né theo. */
let BLK=[];
function addSlot(i,P,L){
 const s=L.slots[i],g=new T.Group();g.position.set(s.x,0,s.z);g.userData.slot=i;world.add(g);
 B(g,1.5,.05,1.5,i===0?P.stone:P.sand,0,-.02,0);
 const rm=new T.MeshBasicMaterial({color:"#46d37f",transparent:true,opacity:.85});
 const ring=new T.Mesh(new T.RingGeometry(.85,.97,32),rm);ring.rotation.x=-Math.PI/2;ring.position.y=.06;g.add(ring);
 const slot=new T.Group();slot.position.y=.02;g.add(slot);
 const lab=mkLab();
 const rec={i,g,slot,ring,rm,lab,model:null,pos:new T.Vector3(s.x,2.4,s.z)};
 SLOT.push(rec);return rec;
}
function setLevel(rec,lv,anim){
 const i=rec.i,P=rec.P,L=rec.L;rec.lv=lv;
 if(rec.model){rec.slot.remove(rec.model);rec.model=null}
 if(lv<=0){rec.lab.textContent=`${slotIcon(i)} ${slotName(i)} · đất trống`;return}
 const g=new T.Group();
 if(i===0)HB[THEMES[L.t].h](g,P,lv);
 else if(i===1)TB[THEMES[L.t].t](g,P,lv);
 else FN[THEMES[L.t].fk[i-2]](g,P,lv);
 rec.slot.add(g);rec.model=g;rec.lab.textContent=`${slotIcon(i)} ${slotName(i)} · C${lv}${lv>=3?" ✓":""}`;
 if(anim&&!RM)pops.push(rec.slot);else rec.slot.scale.setScalar(1);
}
let L3=null,P3=null,STY="";
/* 🎨 D4: bốn nhánh phong cách của đảo (island_style) chồng lên mặc định.
   Cả bốn null thì P3/tod/fog y hệt cảnh trước khi có phong cách — đảo mặc định không đổi. */
const sty=()=>(S.decor&&S.decor.styles&&S.decor.styles[S.cur])||{};
const styKey=()=>{const s=sty();return JSON.stringify([s.weather||null,s.tod||null,s.grass||null,s.sky||null])};
function buildWorld(){
 const L=genIsland(S.cur),TH=THEMES[L.t],st=sty();
 const gp=st.grass?IC.styleOf(st.grass):null,sk=st.sky?IC.styleOf(st.sky):null;
 if(st.tod){const td=IC.styleOf(st.tod);if(td)L.tod=td.tod}
 P3=Object.assign({},shiftPal(TH.c,L.hue+(gp?gp.hue:0),L.lit+(gp?gp.lit:0)),{sea:TH.c.sea,sky:sk?sk.sky:TH.c.sky});
 const tod=TODS[L.tod];
 const skyC=new T.Color(P3.sky).lerp(new T.Color(tod.sky),.6);
 scene.background=skyC;scene.fog=new T.Fog(skyC,L.r*3.4,L.r*9);
 hemi.color.copy(skyC);hemi.groundColor.set(P3.ground);hemi.intensity=S.eco?.55:tod.hemi;
 sun.intensity=tod.sun;sun.color.set(L.tod===2?"#ffb27a":L.tod===3?"#a9bcff":"#fff1d2");
 sun.castShadow=!S.eco;water.material.color.set(P3.sea);view.style.background="#"+skyC.getHexString();
 clearGroup(world);clearGroup(amb);clearPets();
 const sand=put(world,jit(new T.CylinderGeometry(L.r,L.r,1.3,52),L,1.03),P3.sand,0,-.75,0);
 const grass=put(world,jit(new T.CylinderGeometry(L.r,L.r,1.25,52),L,1),P3.ground,0,-.6,0);
 grass.receiveShadow=true;sand.receiveShadow=true;
 for(let i=0;i<5;i++){const r=addSlot(i,P3,L);r.P=P3;r.L=L;setLevel(r,S.islands[S.cur][i],false)}
 const dn=S.eco?Math.ceil(L.decor.length/2):L.decor.length;
 for(let k=0;k<dn;k++){
  const d=L.decor[k],x=d.a,dd=Math.min(d.d,L.r-1),px=dd*Math.cos(x),pz=dd*Math.sin(x);
  if(!walkable(L,px,pz,.1))continue;
  if(d.k==="rock")put(world,new T.DodecahedronGeometry(.22*d.s),P3.stone,px,.12*d.s,pz);
  else if(d.k==="bush"){Sp(world,.26*d.s,P3.leaf,px,.16*d.s,pz).scale.set(1.2,.8,1.2)}
  else{Cy(world,.02,.02,.2*d.s,P3.leaf2,px,0,pz,5);Sp(world,.09*d.s,k%2?P3.accent:P3.glow,px,.2*d.s,pz)}
 }
 if(L.tod===3){const SR=rand(hash("star-"+L.n));for(let k=0;k<40;k++){const a=SR()*6.283,d=L.r+6+SR()*22;put(world,new T.SphereGeometry(.18,6,5),"#ffffff",Math.cos(a)*d,6+SR()*14,Math.sin(a)*d,{emissive:"#ffffff",emissiveIntensity:1})}}
 buildAmbience(TH.amb,P3,L);
 buildWeather(st,P3,L);
 L3=L;STY=styKey();drawDecor();syncAgents(true);
}
function buildAmbience(kind,P,L){
 clearGroup(amb);if(RM||S.eco)return;
 const col={petals:P.leaf,leaves:P.leaf2,sand:P.sand,snow:"#ffffff",waves:P.wall,clouds:"#ffffff",bubbles:P.glow,fireflies:P.glow}[kind]||P.leaf;
 const n={petals:70,leaves:60,sand:40,snow:70,waves:14,clouds:9,bubbles:50,fireflies:44}[kind]||40;
 for(let k=0;k<n;k++){
  const a=Math.random()*6.283,d=Math.random()*L.r*1.1;
  const m=kind==="clouds"?Sp(amb,.7+Math.random()*.6,"#ffffff",(d-L.r)*1.4,7+Math.random()*3,Math.sin(a)*d*1.3,{transparent:true,opacity:.85}):
   put(amb,new T.BoxGeometry(.09,.09,.09),mat(col,kind==="fireflies"||kind==="bubbles"?{emissive:col,emissiveIntensity:.9}:null),Math.cos(a)*d,1+Math.random()*4,Math.sin(a)*d);
  if(kind==="waves"){m.scale.set(1.6,.12,.5);m.position.y=.2}
  m.userData.v={y:-(kind==="bubbles"?.7:kind==="fireflies"?.25:.9)-Math.random()*.5,x:(Math.random()-.5)*.3,z:(Math.random()-.5)*.3,ph:Math.random()*6.283,kind};
  AMBP.push(m);
 }
}
/* 🎨 D4: nhánh "thời tiết" của phong cách đảo — mưa / tuyết / cánh hoa bay / sương.
   Cùng hệ hạt với buildAmbience (AMBP + một vòng update duy nhất), 🪫 hoặc giảm chuyển động là không dựng gì. */
function buildWeather(st,P,L){
 if(RM||S.eco)return;
 const w=st.weather?IC.styleOf(st.weather):null;if(!w||!w.fx)return;
 const cfg={rain:{n:60,c:"#9fc7e8",vy:-8},snow:{n:50,c:"#ffffff",vy:-1.4},petals:{n:45,c:P.accent,vy:-1.1},fog:{n:9,c:"#dfe8f2",r:2.2,vy:0}}[w.fx];
 if(!cfg)return;
 for(let k=0;k<cfg.n;k++){
  const a=Math.random()*6.283,d=Math.random()*L.r*1.15;
  const m=cfg.r?Sp(amb,cfg.r*(.6+Math.random()*.7),cfg.c,Math.cos(a)*d,.45+Math.random()*1.1,Math.sin(a)*d,{transparent:true,opacity:.3}):
   put(amb,new T.BoxGeometry(w.fx==="rain"?.02:.08,w.fx==="rain"?.5:.08,w.fx==="rain"?.02:.08),mat(cfg.c,w.fx==="snow"?{emissive:cfg.c,emissiveIntensity:.35}:null),Math.cos(a)*d,2+Math.random()*5,Math.sin(a)*d);
  m.userData.v={y:cfg.vy,x:(Math.random()-.5)*.3,z:(Math.random()-.5)*.3,ph:Math.random()*6.283,kind:"w-"+w.fx};
  AMBP.push(m);
 }
}
/* ---- 🎨 D3: 12 món an toàn dựng tay + khuôn chung cho 50 món còn lại ---- */
/* "An toàn" = rẻ (3–10 xu) và gần như không thể chia cắt đảo: 7 món phẳng lớp W thú đi qua được,
   5 món chặn nhỏ/vừa. Mỗi hàm 3–9 khối (nhiều nhất là Luống hoa), không PointLight (đèn chỉ dùng emissive — mục 10 đặc tả). */
const DMESH={
 grass_tuft(g,P){for(let k=0;k<3;k++){const a=k*2.1;K(g,.07,.26,k%2?P.leaf:P.leaf2,Math.cos(a)*.1,0,Math.sin(a)*.1,5)}},
 flower_patch(g,P){B(g,.5,.06,.34,P.stone,0,0,0);
  for(let k=0;k<4;k++){const a=k*1.7,x=Math.cos(a)*.16,z=Math.sin(a)*.09;
   Cy(g,.015,.015,.1,P.leaf2,x,.06,z,4);Sp(g,.06,k%2?P.accent:P.glow,x,.17,z)}},
 stone_path(g,P){for(let k=0;k<2;k++)Cy(g,.2,.24,.06,P.stone,k*.12-.06,0,k?.1:-.08,6)},
 stepping(g,P){for(let k=0;k<3;k++)B(g,.24,.08,k%2?.2:.16,P.stone,-.28+k*.28,0,k===1?.08:-.06)},
 wood_path(g,P){for(let k=0;k<3;k++)B(g,.2,.06,.56,P.wood,-.28+k*.28,0,0)},
 brick_path(g,P){for(let k=0;k<4;k++)B(g,.24,.06,.16,k%2?P.roof:P.wall,((k>>1)-1)*.26,0,(k%2?-.1:.1))},
 rock_small(g,P){const m=put(g,new T.DodecahedronGeometry(.2),P.stone,0,.14,0);m.rotation.set(.3,.7,.2)},
 bush(g,P){Sp(g,.4,P.leaf,0,.3,0).scale.set(1.15,.85,1.15);Sp(g,.2,P.leaf2,.22,.22,-.12).scale.set(1.1,.8,1.1)},
 sapling(g,P){Cy(g,.05,.07,.5,P.trunk,0,0,0,7);Sp(g,.24,P.leaf,0,.62,0).scale.set(1,.85,1)},
 lantern(g,P){Cy(g,.22,.26,.1,P.stone,0,0,0,10);Cy(g,.04,.04,.5,P.wood,0,.1,0,6);
  B(g,.26,.3,.26,P.glow,0,.5,0,{emissive:P.glow,emissiveIntensity:.85});K(g,.28,.18,P.roof,0,.8,0,4)},
 fence(g,P){for(let k=-1;k<2;k++)B(g,.07,.5,.07,P.wood,k*.3,0,0);B(g,.9,.07,.05,P.wood,0,.3,0);B(g,.9,.06,.05,P.wood,0,.14,0)},
 water_bowl(g,P){Cy(g,.3,.24,.12,P.stone,0,0,0,14);Cy(g,.24,.24,.05,P.water,0,.1,0,14,{roughness:.15,emissive:"#2a7fa8",emissiveIntensity:.2})}
};
/* Khuôn chung: bệ + một hình theo nhóm, cỡ theo bán kính thật của lớp. FX chỉ một chấm sáng. */
function decGeneric(g,it,P){
 if(it.cls==="FX"){Sp(g,.14,P.glow,0,1.1,0,{emissive:it.glow||P.glow,emissiveIntensity:.9});return}
 const c={plants:P.leaf,path:P.stone,light:P.glow,garden:P.wood,water:P.stone,pet:P.accent,landmark:P.wall}[it.cat]||P.stone;
 const r=Math.max(it.r,.24);
 B(g,r*1.6,.06,r*1.6,P.sand,0,0,0);
 if(it.cat==="plants"){Cy(g,r*.28,r*.34,r*1.5,P.trunk,0,.06,0,8);Sp(g,r*.9,c,0,r*1.7,.06)}
 else if(it.cat==="light"){Cy(g,r*.3,r*.4,r*2,c,0,.06,0,10);Sp(g,r*.45,P.glow,0,r*2.2,.06,{emissive:it.glow||P.glow,emissiveIntensity:.85})}
 else if(it.cat==="water")Cy(g,r,r*.92,r*.4,P.water,0,.06,0,16,{roughness:.2,emissive:"#2a7fa8",emissiveIntensity:.15});
 else if(it.cat==="landmark"){B(g,r*1.3,r*2.6,r*1.3,c,0,.06,0);K(g,r*1.1,r*1.1,P.roof,0,r*2.66,0,8)}
 else B(g,r*1.5,r*1.2,r*1.2,c,0,.06,0)}
function decMesh(it,P){
 const g=new T.Group();
 try{(DMESH[it.k]||decGeneric)(g,it,P)}catch(e){console.error("dựng món hỏng",it.k,e)}
 /* chỉ món chặn mới đổ bóng (mục 10); máy yếu thì tắt hẳn */
 g.traverse(o=>{if(o.isMesh)o.castShadow=!S.eco&&(it.cls==="M"||it.cls==="L"||it.cls==="XL")});
 return g}
/* ---- bóng xem trước: một đĩa + vòng, bám lưới 0,25, xanh = đặt được, đỏ = không ---- */
const GH={g:null,x:null,z:null,key:null,n:-1};
const GPLANE=new T.Plane(new T.Vector3(0,1,0),0),GPT=new T.Vector3();
const groundAt=(ray)=>ray.ray.intersectPlane(GPLANE,GPT)?{x:GPT.x,z:GPT.z}:null;
function decGhost(it,x,z,ok){
 if(!it){if(GH.g)GH.g.visible=false;GH.key=null;return}
 if(!GH.g){GH.g=new T.Group();
  GH.pad=new T.Mesh(new T.CylinderGeometry(1,1,.04,20),new T.MeshBasicMaterial({color:"#46d37f",transparent:true,opacity:.5}));
  GH.ring=new T.Mesh(new T.TorusGeometry(1,.05,8,24),new T.MeshBasicMaterial({color:"#46d37f"}));GH.ring.rotation.x=Math.PI/2;
  GH.g.add(GH.pad,GH.ring);scene.add(GH.g)}
 GH.g.visible=true;
 const r=Math.max(it.r,.24)+.1;
 GH.g.scale.set(r,1,r);GH.g.position.set(x,.05,z);
 const c=ok?"#46d37f":"#e5484d";GH.pad.material.color.set(c);GH.ring.material.color.set(c);
 GH.x=x;GH.z=z;GH.key=it.k;GH.n=DEC.items.length}
/* ---- vẽ đồ đang nháp + danh sách vật cản cho thú ---- */
function drawDecor(){
 if(!L3)return;
 D3.disposeGroup(decoRoot);
 for(let i=0;i<DEC.items.length;i++){
  const p=DEC.items[i],it=IC.decorOf(p.item);if(!it)continue;
  /* 🪫 D4: Tiết kiệm cất món phẳng (W) và hiệu ứng (FX) — món CHẶN vẫn vẽ để BLK và đường đi của thú không đổi. */
  if(S.eco&&!IC.isBlocker(it))continue;
  const g=decMesh(it,P3);
  g.position.set(p.x,0,p.z);g.rotation.y=p.rot*Math.PI/4;g.userData.dec=i;decoRoot.add(g);
  if(i===DEC.sel){const q=new T.Mesh(new T.RingGeometry(Math.max(it.r,.2)+.12,Math.max(it.r,.2)+.22,24),
    new T.MeshBasicMaterial({color:"#ffd54a",transparent:true,opacity:.9}));q.rotation.x=-Math.PI/2;q.position.y=.03;g.add(q)}
 }
 BLK=IC.blockersOf(L3,DEC.items)}
/* DEC3 là cửa duy nhất từ phần chữ vào cảnh 3D (L3/P3/BLK nằm trong khối WebGL),
   nên máy không có WebGL vẫn chạy được phần tự kiểm tra bằng bảng chữ. */
DEC3={draw:drawDecor,ghost:decGhost,mesh:(it)=>decMesh(it,P3),blocks:()=>BLK,island:()=>L3,cam:()=>cam,root:()=>decoRoot,
 refresh(){if(styKey()===STY)return false;buildWorld();render();return true},
 /* ⏱ D4: hai phép đo chạy trong khối WebGL, phần chữ chỉ gọi qua cửa này */
 perf:()=>perf(60),perfReport,freeze:()=>freeze(30),
 /* số đọc được cho tự kiểm tra D4: bảng màu + số hạt + màu trời/fog sau khi dựng cảnh */
 stats:()=>({amb:AMBP.length,kinds:AMBP.reduce((o,m)=>{o[m.userData.v.kind]=(o[m.userData.v.kind]||0)+1;return o},{}),
  sty:STY,tod:L3&&L3.tod,bg:scene.background?scene.background.getHexString():null,
  fog:scene.fog?scene.fog.color.getHexString():null,ground:P3?P3.ground:null,sky:P3?P3.sky:null}),
 ghostInfo:()=>({key:GH.key,x:GH.x,z:GH.z,on:!!(GH.g&&GH.g.visible),color:GH.pad?GH.pad.material.color.getHexString():null})};

const rndWalk=rand(hash("pet-rng"));
function bowl(){if(!bowl.g){bowl.g=Sp(world,.16,"#e5484d",0,.08,0);bowl.g.visible=false}return bowl.g}
function ball(){if(!ball.g){ball.g=Sp(world,.1,"#4a7de0",0,20,0,{emissive:"#2a5a9c",emissiveIntensity:.3});ball.g.visible=false}return ball.g}
function newAgent(p,idx){
 const b=BREEDS.find(x=>x.k===p.breed),g=petMesh(b,friendLv(p.xp));
 const sp=pickSpot(L3,rndWalk,0,0,BLK);
 g.position.set(sp.x,0,sp.z);g.userData.pet=p.id;petRoot.add(g);
 const lab=mkLab();
 const a={p,b,g,lab,x:sp.x,z:sp.z,yaw:0,st:"wander",tgt:null,wt:0,timer:0,speed:b.speed,hidden:false,seat:idx,hidCheck:0};
 AGENTS.push(a);return a;
}
function syncAgents(rebuild){
 const ids=S.pets.slice(0,S.seen).map(p=>p.id).join("-");
 if(!rebuild&&ids===syncAgents.sig)return;
 syncAgents.sig=ids;
 for(const a of AGENTS){petRoot.remove(a.g);a.lab.remove();a.g.traverse(o=>{if(o.geometry)o.geometry.dispose()})}
 AGENTS.length=0;
 S.pets.slice(0,S.seen).forEach((p,i)=>newAgent(p,i));
}
/* đi thẳng có né vật chắn: thử hướng đích rồi trượt tiếp tuyến hai bên;
   kẹt 1,5 giây thì coi như không tới được (gọi lại để chọn đích mới).
   BLK là đồ trang trí đang đặt — thêm vào đúng chỗ 5 ô đất vẫn chặn, nên hành vi thú không đổi khi đảo trống. */
function moveTo(a,tx,tz,dt){
 const dx=tx-a.x,dz=tz-a.z,d=Math.hypot(dx,dz);
 if(d<.12)return true;
 const v=Math.min(a.speed*dt,d),ux=dx/d,uz=dz/d;
 for(const ang of[0,.85,-.85,1.7,-1.7]){
  const c=Math.cos(ang),s=Math.sin(ang),rx=ux*c-uz*s,rz=ux*s+uz*c;
  if(walkable(L3,a.x+rx*v,a.z+rz*v,.25,BLK)){a.x+=rx*v;a.z+=rz*v;a.yaw=Math.atan2(rx,rz);a.stuck=0;
   return Math.hypot(tx-a.x,tz-a.z)<.14}}
 a.stuck=(a.stuck||0)+dt;
 if(a.stuck>1.5){a.stuck=0;if(!walkable(L3,a.x,a.z,.05,BLK)){const q=pickSpot(L3,rndWalk,a.x,a.z,BLK);a.x=q.x;a.z=q.z}return true}
 return false;
}
/* houseSpot/treeSpot cũng về lõi (doorSpot/treeSpot) — luật đặt đồ cần đúng hai chỗ này làm "vùng cấm". */
const houseSpot=doorSpot;
function stepAgents(dt,t){
 for(const a of AGENTS){
  const p=a.p,night=L3&&L3.tod===3,tired=p.sat<45||p.mood<45;
  if(!a.hidCheck||((t-a.hidCheck)>3)){a.hidCheck=t;
   const wantRest=(night||tired)&&a.st!=="eat"&&a.st!=="play";
   if(wantRest&&a.st!=="rest"){a.st="rest";a.tgt=night?houseSpot(L3):treeSpot(L3);a.wt=0}
   if(!wantRest&&a.st==="rest"){a.st="wander";a.tgt=pickSpot(L3,rndWalk,a.x,a.z,BLK);a.hidden=false;a.g.visible=true}
  }
  a.lab.textContent=`${a.b.sp} ${a.p.name}${a.st==="rest"?" 💤":a.p.sat<45?" 🥣":a.p.mood<45?" 😴":""}${friendLv(a.p.xp)>=3?" 🎀":""}`;
  if(RM){a.g.position.set(a.x,0,a.z);a.g.rotation.y=a.yaw;a.g.visible=a.st!=="rest";continue}
  switch(a.st){
   case"wander":
    if(a.wt>0){a.wt-=dt;break}
    if(!a.tgt)a.tgt=pickSpot(L3,rndWalk,a.x,a.z,BLK);
    if(moveTo(a,a.tgt.x,a.tgt.z,dt)){a.tgt=null;a.wt=1+rndWalk()*2.5}
    break;
   case"follow":
    if(a.tgt&&moveTo(a,a.tgt.x,a.tgt.z,dt)){a.tgt=null;a.wt=6;a.st="wait"}
    break;
   case"wait":
    a.wt-=dt;if(a.wt<=0){a.st="wander";a.tgt=pickSpot(L3,rndWalk,a.x,a.z,BLK)}
    break;
   case"rest":
    if(a.tgt&&moveTo(a,a.tgt.x,a.tgt.z,dt)){a.tgt=null;a.hidden=L3.tod===3;a.g.visible=!a.hidden}
    break;
   case"eat":
    if(a.tgt&&moveTo(a,a.tgt.x,a.tgt.z,dt)){a.timer+=dt;if(a.timer>1.6){a.timer=0;a.st="wander";a.tgt=null;a.wt=1;bowl().visible=false}}
    break;
   case"play":
    if(a.tgt&&moveTo(a,a.tgt.x,a.tgt.z,dt)){a.st="wander";a.tgt=null;a.wt=1;ball().visible=false}
    break;
   case"react":
    a.timer+=dt;if(a.timer>.7){a.timer=0;a.st="wander"}
  }
  a.g.position.set(a.x,0,a.z);
  let dy=0;
  if(a.st==="wander"||a.st==="follow"||a.st==="play"||a.st==="rest")dy=Math.abs(Math.sin(t*7*a.speed))*.04;
  if(a.st==="react")dy=Math.max(0,Math.sin(a.timer/0.7*Math.PI))*.35;
  a.g.position.y=dy+(a.st==="wait"?.02:0);
  a.g.rotation.y=a.yaw;
  const u=a.g.userData,moving=dy>.005;
  (u.leg||[]).forEach((l,k)=>l.rotation.x=moving?Math.sin(t*9*a.speed+(k>1?Math.PI:0))*.5:0);
  if(u.tail)u.tail.rotation.y=moving?Math.sin(t*8*a.speed)*.5:Math.sin(t*1.6)*.12;
  if(u.head)u.head.rotation.z=Math.sin(t*1.4+a.seat)*.05;
  (u.eye||[]).forEach(e=>e.scale.y=(a.st==="rest"||a.p.sat<40)?.15:1);
  (u.glow||[]).forEach((q,k)=>q.material.emissiveIntensity=.6+.4*Math.sin(t*3+k));
 }
}
/* ---- camera + chuột ---- */
/* hit(ray) → {pet} con thú | {dec} món trang trí | {slot} ô đất | {ground} mặt đất — ai gần máy ảnh hơn thắng */
function hit(ray){
 const w=ray.intersectObjects(world.children,true)[0],pt=ray.intersectObjects(petRoot.children,true)[0],dc=ray.intersectObjects(decoRoot.children,true)[0];
 const first=[w,pt,dc].filter(Boolean).sort((a,b)=>a.distance-b.distance)[0];
 if(!first)return null;
 for(let o=first.object;o;o=o.parent){
  if(o.userData.pet!==undefined)return{pet:o.userData.pet};
  if(o.userData.dec!==undefined)return{dec:o.userData.dec};
  if(o.userData.slot!==undefined)return{slot:o.userData.slot}}
 return first===w?{ground:true}:null}
function callPets(){
 if(!AGENTS.length){msg("Chưa có thú nào — vào 🛒 Cửa hàng thú nhận nuôi đã.");return}
 AGENTS.slice(0,2).forEach(a=>{a.st="follow";a.tgt=pickSpot(L3,rndWalk,a.x,a.z,BLK)});
 msg("📣 Bạn gọi — thú chạy tới rồi ngồi chờ (không có thưởng).")}
/* Con trỏ (hoặc chạm) đang chỉ đâu trên mặt đảo: bám lưới rồi chạy đúng luật canPlace. */
function decHover(px,pz){
 const it=IC.decorOf(DEC.pick);if(!it)return;
 const x=IC.snap(px),z=IC.snap(pz),n=DEC.items.length;
 if(GH.key===it.k&&GH.x===x&&GH.z===z&&GH.n===n)return;
 const r=IC.canPlace(L3,DEC.items,it.k,x,z,0,{slots:S.islands,baseFraction:decBase()});
 decGhost(it,x,z,r.ok);
 setWhy(r.ok?"ok":"bad",r.ok?`Đặt được tại (${x}, ${z}) — chạm hoặc bấm để đặt, R để xoay trước khi đặt.`:`Chưa đặt được ${it.name}: ${r.reason}`)}
const orbit=D3.orbit({cv,view,cam,tgt:new T.Vector3(0,.9,0),home:{th:.8,ph:1.02,r:22},min:10,max:40,
 onHover:ray=>{
  if(TAB==="decor"){if(DEC.pick){const q=groundAt(ray);if(q)decHover(q.x,q.z)}return null}
  const o=hit(ray);return o&&o.slot!==undefined?o:null},
 onTap:ray=>{
  if(TAB==="decor"){
   /* đang cầm đồ thì mọi cú bấm là "đặt xuống mặt đảo"; nếu không, bấm món đã đặt để chọn.
      Không cú bấm nào ở chế độ này nâng cấp ô đất — khỏi sợ mất xu khi đang sửa cảnh. */
   if(DEC.pick){const q=groundAt(ray);
    if(!q){msg("Chạm chưa trúng mặt đảo — thử lại vào giữa đảo nhé.");return}
    /* đặt xong thì tắt bóng: chạm/click không có "rê lại" như chuột, bóng sẽ treo ngay chỗ vừa đặt */
    if(decAdd(DEC.pick,IC.snap(q.x),IC.snap(q.z),0))decGhost(null);
    return}
   const o=hit(ray);
   if(o&&o.dec!==undefined)decSelect(o.dec);
   else if(o&&o.pet!==undefined){const a=AGENTS.find(x=>x.p.id===o.pet);if(a){a.st="react";a.timer=0}}
   return}
  const o=hit(ray);if(!o)return;
  if(o.slot!==undefined)doUpgrade(o.slot);
  else if(o.pet!==undefined){const a=AGENTS.find(x=>x.p.id===o.pet);if(a){a.st="react";a.timer=0;msg(`🐾 ${a.p.name} nhảy lên chào. Bấm thú không cho xu — phần thưởng chỉ đến từ học và chơi.`)}}
  else if(o.ground)callPets()}});orbit.buttons(3);
$("eco").onclick=()=>{S.eco=!S.eco;localStorage.setItem("qd-eco",S.eco?"1":"0");renderer.shadowMap.enabled=!S.eco;renderer.setPixelRatio(S.eco?1:Math.min(2,devicePixelRatio));buildWorld();render();msg(S.eco?`🪫 Chế độ tiết kiệm: tắt bóng đổ, tắt hạt nền + hạt thời tiết (mưa/tuyết/cánh hoa/sương) và thôi vẽ ${DEC.items.filter(p=>!IC.isBlocker(IC.decorOf(p.item))).length} món phẳng · hiệu ứng trên đảo này. Đảo, thú, xu và đường đi của thú giữ nguyên.`:"Đã bật lại đầy đủ hình ảnh.")};
/* ---- vòng lặp ---- */
const pops=D3.pops(),sparks=D3.sparks(scene),vp=new T.Vector3();
let last=performance.now();
/* step3 = toàn bộ phần tính toán của một khung hình (không vẽ). Tách ra để:
   — QD.freeze(n) chứng minh "giảm chuyển động ⇒ đóng băng tuyệt đối" bằng số, không cần GPU;
   — QD.perf(n) đo GIÁ THẬT của cả tính + vẽ ngay trên máy đang chạy. */
function step3(dt,t){
 orbit.tick();
 stepAgents(dt,t);
 pops.step(dt);
 if(!RM&&!S.eco)for(let k=AMBP.length-1;k>=0;k--){const m=AMBP[k],v=m.userData.v;
  m.position.y+=v.y*dt;if(m.position.y<.1){const a=Math.random()*6.283,d=Math.random()*L3.r*1.1;m.position.set(Math.cos(a)*d,v.kind==="bubbles"?.1:v.kind==="w-rain"?7+Math.random()*3:3+Math.random()*4,Math.sin(a)*d)}
  m.position.x+=Math.sin(t+v.ph)*dt*.3;if(v.kind!=="w-rain"){m.rotation.y+=dt;m.rotation.x+=dt*.6}
  if(v.kind==="fireflies")m.material.emissiveIntensity=.4+.6*Math.abs(Math.sin(t*2+v.ph))}
 for(const s of SLOT){s.lab&&LB.proj(cam,s.lab,s.pos.set(L3.slots[s.i].x,2.3+(s.i===0?.4:.2),L3.slots[s.i].z));
  if(s.rm){const c=S.upCost[s.i];s.ring.visible=c!==null&&S.coins>=c;if(!RM)s.rm.opacity=.4+.45*Math.sin(t*4)}}
 for(const a of AGENTS)LB.proj(cam,a.lab,vp.set(a.x,.95,a.z));
 sparks.step(dt);
}
/* Đông bộ đếm khung hình lại gần như mọi thứ trong cảnh: thú + hạt + món trang trí + ô đất.
   Dưới `prefers-reduced-motion`, step3 không được dịch điểm nào (mv = 0 chính xác). */
function freeze(n){
 const pts=[...AGENTS.map(a=>a.g),...AMBP,...decoRoot.children];
 const p0=pts.map(o=>o.position.clone());
 for(let k=0;k<n;k++)step3(1/60,k/60);
 let mv=0;pts.forEach((o,i)=>{mv+=o.position.distanceTo(p0[i])});
 return {n,mv,pts:pts.length,amb:AMBP.length,dec:decoRoot.children.length,rm:RM,eco:!!S.eco};
}
/* ⏱ D4: n khung hình thật, mỗi khung ép GPU trả hàng bằng readPixels ở 1 điểm (nếu không,
   số đo chỉ là thời gian gửi lệnh — GPU vẫn còn âm thầm vẽ phía sau). */
function perf(n){
 const gl=renderer.getContext(),px=new Uint8Array(4),ts=[];
 let prev=performance.now();
 for(let k=0;k<n;k++){
  const a=performance.now();step3(1/60,a/1000);renderer.render(scene,cam);
  gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);
  const b=performance.now();ts.push(b-prev);prev=b;last=a;
 }
 ts.sort((x,y)=>x-y);
 const mean=ts.reduce((x,y)=>x+y,0)/ts.length,r=renderer.info.render;
 return {n,mean,med:ts[ts.length>>1],min:ts[0],max:ts[ts.length-1],fps:1000/mean,
  calls:r.calls,tri:r.triangles,geo:renderer.info.memory.geometries,tex:renderer.info.memory.textures,
  eco:!!S.eco,rm:RM,items:DEC.items.length,blk:BLK.length,amb:AMBP.length,
  w:cv.width,h:cv.height,dpr:+(devicePixelRatio||1).toFixed(2)};
}
function perfReport(){
 const p=perf(60);
 setWhy("ok",`⏱ ${p.n} khung hình liên tiếp trên máy này: trung bình ${p.mean.toFixed(1)} ms (≈ ${p.fps.toFixed(0)} FPS), giữa ${p.min.toFixed(1)}–${p.max.toFixed(1)} ms · ${p.calls} lệnh vẽ · ${p.tri.toLocaleString("vi-VN")} tam giác · ${p.geo} hình học · ${p.amb} hạt · ${p.items} món đặt · ${p.eco?"🪫 Tiết kiệm":"đầy đủ"}${p.rm?" · giảm chuyển động":""}.`);
 msg(`⏱ Đã đo ${p.n} khung hình: ${p.mean.toFixed(1)} ms ≈ ${p.fps.toFixed(0)} FPS, ${p.calls} lệnh vẽ.`);
 return p;
}
function frame(now){step3(Math.min(.05,(now-last)/1000),now/1000);last=now;renderer.render(scene,cam)}
function loop(now){frame(now);requestAnimationFrame(loop)}
VISIT={
 sync(){const n=S.cur,li=S.islands[S.cur];if(n!==VISIT.cur||li.join()!==VISIT.arr){const changed=n!==VISIT.cur;VISIT.cur=n;VISIT.arr=li.join();if(changed)buildWorld();else li.forEach((lv,i)=>{const r=SLOT[i];if(r&&r.lv!==lv){r.lv=lv;setLevel(r,lv,true)}})}
  syncAgents(false)},
 grow(i){const r=SLOT[i];if(r){r.lv=S.islands[S.cur][i];setLevel(r,r.lv,true);burstAt(r.pos)}},
 celebrate(){if(RM)return;burstAt(new T.Vector3(0,3,0));burstAt(new T.Vector3(3,2.5,3));burstAt(new T.Vector3(-3,2.5,-3))},
 eat(id,fk){const a=AGENTS.find(x=>x.p.id===id);if(!a)return;const b=bowl();b.visible=true;const h=houseSpot(L3);b.position.set(h.x,.1,h.z);a.st="eat";a.tgt={x:h.x,z:h.z};a.timer=0},
 play(id){const a=AGENTS.find(x=>x.p.id===id);if(!a)return;const s=pickSpot(L3,rndWalk,a.x,a.z,BLK),bl=ball();bl.visible=true;bl.position.set(s.x,.15,s.z);a.st="play";a.tgt=s},
 react(id){const a=AGENTS.find(x=>x.p.id===id);if(a){a.st="react";a.timer=0}},
 call(){callPets()}
};
function burstAt(v){if(RM||S.eco)return;sparks.at(v,14)}
buildWorld();VISIT.cur=S.cur;VISIT.arr=S.islands[S.cur].join();
window.QD={S:()=>S,L:()=>L3,SLOT:()=>SLOT,AG:()=>AGENTS,step:stepAgents,walk:walkable,edge:edgeOf,render,frame:loop,
 up:doUpgrade,feed,care,adopt,travel,buyFood,pull,selfCheck:()=>{runChecks();return $("chk").textContent},
 /* 🎨 tay cầm cho tab trang trí: kiểm thử đi qua đúng các hàm người dùng bấm, không có đường tắt riêng */
 DEC:()=>DEC,LIM,blk:()=>BLK,gh:()=>DEC3&&DEC3.ghostInfo(),d3:()=>DEC3,decTry,decLeft,decAreaList,decHold,decAdd,decAddArea,decSelect,decMove,decRotate,decNudgeSel,
 decStore,decUndo,decRedo,decSave,decCancel,decBuy,decOpen,withDecGuard,tab:()=>TAB,
 /* 🎨 D4: phong cách + số đo hiệu năng thật */
 sty:()=>styCur(),hasSty:styHas,styBuy,styPick,stats:()=>DEC3&&DEC3.stats(),
 /* kiểm chứng "giảm chuyển động ⇒ đóng băng tuyệt đối" mà không phải đổi cài đặt OS */
 rm(v){RM=!!v;D3.RM=RM;buildWorld();render();return RM},perf:(n)=>perf(n||60),freeze:(n)=>freeze(n||30)};
requestAnimationFrame(loop);$("err").hidden=true;
}catch(e){$("err").hidden=false;console.error(e)}
render();
if(location.protocol!=="file:")pull();else needServer("");
