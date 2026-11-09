/* Lõi dùng chung cho hai bản demo 3D (thi_tran3D-three.html và quan-dao-vo-tan-three.html):
   một bản sao cho camera, nhãn HTML, khối cơ bản, hiệu ứng xây, hộp xác nhận, CSS.
   Hai trang này chỉ VẼ — số dư và giá đọc từ /api/town và /api/islands, không có nút giả lập.
   Bản thật trong src/town3d.js không nạp file này. */
(function(){
const D3=window.D3={};
const $=D3.$=i=>document.getElementById(i);
D3.clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
D3.RM=matchMedia("(prefers-reduced-motion: reduce)").matches;
D3.msg=t=>{const e=$("msg");if(e)e.textContent=t};

/* ---------- hộp xác nhận (mọi lần tiêu đều đi qua đây) ---------- */
D3.confirm=(title,body,onOk)=>{
 $("dt").textContent=title;$("db").textContent=body;$("ovl").hidden=false;$("dok").focus();
 const close=()=>{$("ovl").hidden=true;$("dok").onclick=null;$("dno").onclick=null};
 $("dok").onclick=()=>{close();onOk()};$("dno").onclick=close;
};
addEventListener("keydown",e=>{if(e.key==="Escape"&&$("ovl")&&!$("ovl").hidden)$("dno").click()});

const T=window.THREE;if(!T)return;
D3.T=T;

/* ---------- khối cơ bản + vật liệu đệm có cache ---------- */
const MC={};
D3.mat=(c,o)=>{const k=c+(o?JSON.stringify(o):"");return MC[k]||(MC[k]=new T.MeshStandardMaterial(Object.assign({color:c,flatShading:true,roughness:.85},o)))};
D3.put=(g,geo,c,x,y,z,o)=>{const m=new T.Mesh(geo,D3.mat(c,o));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;g.add(m);return m};
D3.B=(g,w,h,d,c,x,y,z,o)=>D3.put(g,new T.BoxGeometry(w,h,d),c,x,y+h/2,z,o);
D3.Cy=(g,rt,rb,h,c,x,y,z,s,o)=>D3.put(g,new T.CylinderGeometry(rt,rb,h,s||14),c,x,y+h/2,z,o);
D3.K=(g,r,h,c,x,y,z,s,o)=>D3.put(g,new T.ConeGeometry(r,h,s||12),c,x,y+h/2,z,o);
D3.Sp=(g,r,c,x,y,z,o)=>D3.put(g,new T.SphereGeometry(r,14,10),c,x,y,z,o);
D3.Ro=(g,w,h,d,c,x,y,z)=>{const s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(0,h);s.closePath();
 const geo=new T.ExtrudeGeometry(s,{depth:d,bevelEnabled:false});geo.translate(0,0,-d/2);return D3.put(g,geo,c,x,y,z)};
D3.disposeGroup=g=>{for(let i=g.children.length-1;i>=0;i--){const c=g.children[i];
 c.traverse(o=>{if(o.geometry)o.geometry.dispose()});g.remove(c)}};

/* ---------- sân khấu: máy vẽ, cảnh, kính, đèn, mặt nước ---------- */
D3.stage=({canvas,view,shadow=16,far=70,camFar=240,water=0,wy=-1.3,fov=42})=>{
 const renderer=new T.WebGLRenderer({antialias:true,canvas:canvas});
 renderer.setPixelRatio(Math.min(2,devicePixelRatio));
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
 const scene=new T.Scene(),cam=new T.PerspectiveCamera(fov,1,.1,camFar);
 const hemi=new T.HemisphereLight("#d6ecff","#7a8f6a",.8),sun=new T.DirectionalLight("#fff1d2",.9);
 sun.position.set(14,22,10);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.0006;
 Object.assign(sun.shadow.camera,{left:-shadow,right:shadow,top:shadow,bottom:-shadow,near:1,far:far});
 sun.shadow.camera.updateProjectionMatrix();scene.add(hemi,sun);
 let pool=null;
 if(water){pool=new T.Mesh(new T.PlaneGeometry(water,water),new T.MeshStandardMaterial({color:"#5fb3d6",roughness:.25,metalness:.1}));
  pool.rotation.x=-Math.PI/2;pool.position.y=wy;scene.add(pool)}
 const size=()=>{const w=view.clientWidth,h=view.clientHeight;renderer.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix()};
 new ResizeObserver(size).observe(view);size();
 /* màu ngày/đêm theo hệ thống: trang gọi lại với (isDark) */
 const onDark=cb=>{const m=matchMedia("(prefers-color-scheme: dark)");const run=()=>cb(m.matches);run();
  m.addEventListener("change",run);return run};
 return {renderer,scene,cam,hemi,sun,pool,size,onDark};
};

/* ---------- nhãn HTML nổi trên cảnh ---------- */
D3.labels=(el,view)=>{
 const v3=new T.Vector3();
 return{
  mk(){const e=document.createElement("div");e.className="lab";el.appendChild(e);return e},
  clear(){el.innerHTML=""},count(){return el.childElementCount},
  proj(cam,node,pos){v3.copy(pos).project(cam);const x=(v3.x*.5+.5)*view.clientWidth,y=(-v3.y*.5+.5)*view.clientHeight;
   node.style.display=v3.z>1?"none":"block";node.style.transform=`translate(${x}px,${y}px) translate(-50%,-100%)`}};
};

/* ---------- ống kính tự viết: kéo xoay, cuộn/chụm zoom, nút bấm ---------- */
D3.orbit=({cv,view,cam,tgt,home,min=10,max=40,onTap,onHover})=>{
 const V={th:home.th,ph:home.ph,r:home.r},Vt=Object.assign({},V);
 const ptr=new Map(),ray=new T.Raycaster(),mv=new T.Vector2();let moved=0,pd=0;
 const place=()=>{cam.position.set(tgt.x+V.r*Math.sin(V.ph)*Math.sin(V.th),tgt.y+V.r*Math.cos(V.ph),tgt.z+V.r*Math.sin(V.ph)*Math.cos(V.th));cam.lookAt(tgt)};
 const pdist=()=>{const a=[...ptr.values()];return Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)||1};
 const o={V,Vt,place,hov:null,pick(e){const r=cv.getBoundingClientRect();
  mv.set((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height)*2+1);ray.setFromCamera(mv,cam);return ray}};
 cv.addEventListener("pointerdown",e=>{cv.setPointerCapture(e.pointerId);ptr.set(e.pointerId,{x:e.clientX,y:e.clientY});moved=0;if(ptr.size===2)pd=pdist()});
 cv.addEventListener("pointermove",e=>{const p=ptr.get(e.pointerId);
  if(!p){o.hov=onHover?onHover(o.pick(e),e):null;cv.style.cursor=o.hov?"pointer":"grab";return}
  const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;moved+=Math.abs(dx)+Math.abs(dy);
  if(ptr.size===1){Vt.th-=dx*.006;Vt.ph=D3.clamp(Vt.ph-dy*.005,.3,1.35)}
  else if(ptr.size===2){const d=pdist();Vt.r=D3.clamp(Vt.r*pd/d,min,max);pd=d}});
 cv.addEventListener("pointerup",e=>{ptr.delete(e.pointerId);
  if(moved<6&&ptr.size===0&&onTap)onTap(o.pick(e),e,o)});
 cv.addEventListener("pointercancel",e=>ptr.delete(e.pointerId));
 cv.addEventListener("wheel",e=>{e.preventDefault();Vt.r=D3.clamp(Vt.r+e.deltaY*.02,min,max)},{passive:false});
 o.tick=()=>{for(const k of["th","ph","r"])V[k]+=D3.RM?Vt[k]-V[k]:(Vt[k]-V[k])*.12;place()};
 o.buttons=(step)=>{const s=step||4;$("l").onclick=()=>Vt.th-=.5;$("r").onclick=()=>Vt.th+=.5;
  $("zi").onclick=()=>Vt.r=D3.clamp(Vt.r-s,min,max);$("zo").onclick=()=>Vt.r=D3.clamp(Vt.r+s,min,max)};
 return o;
};

/* ---------- hiệu ứng xây (nảy lên) + pháo hoa khối ---------- */
D3.pops=()=>{const list=[];return{
 push(o){list.push({o,t:0});o.scale.setScalar(.01)},
 step(dt){for(let k=list.length-1;k>=0;k--){const p=list[k];p.t+=dt/.5;const u=Math.min(1,p.t)-1;
  p.o.scale.setScalar(Math.max(.01,1+2.70158*u*u*u+1.70158*u*u));if(p.t>=1){p.o.scale.setScalar(1);list.splice(k,1)}}}}};
D3.sparks=scene=>{const list=[];return{
 at(v,n){for(let k=0;k<(n||16);k++){const m=new T.Mesh(new T.BoxGeometry(.12,.12,.12),D3.mat(k%2?"#ffd54a":"#6fe39a"));
   m.position.copy(v);const a=Math.random()*6.283;
   m.userData.v=new T.Vector3(Math.cos(a)*(1+Math.random()*2),3+Math.random()*3,Math.sin(a)*(1+Math.random()*2));
   m.userData.life=1;scene.add(m);list.push(m)}},
 step(dt){for(let k=list.length-1;k>=0;k--){const p=list[k];p.userData.v.y-=9*dt;
  p.position.addScaledVector(p.userData.v,dt);p.userData.life-=dt*1.4;p.scale.setScalar(Math.max(.01,p.userData.life));
  if(p.userData.life<=0){scene.remove(p);list.splice(k,1)}}}}};

/* ---------- mây trang trí ---------- */
D3.clouds=(parent,n,rad,ybase)=>{const g=new T.Group();parent.add(g);
 for(let k=0;k<n;k++){const c=new T.Group(),a=k*1.26,r=rad+k%2*4;
  c.position.set(r*Math.cos(a),ybase+k%3*2,r*Math.sin(a));
  [[0,0,0,1.6],[1.4,-.2,.3,1.2],[-1.3,-.2,-.2,1.2]].forEach(s=>{
   const m=new T.Mesh(new T.SphereGeometry(s[3],10,8),new T.MeshBasicMaterial({color:"#fff",transparent:true,opacity:.92}));
   m.position.set(s[0],s[1],s[2]);c.add(m)});g.add(c)}
 g.step=dt=>{g.rotation.y+=dt*.01};return g};
})();
