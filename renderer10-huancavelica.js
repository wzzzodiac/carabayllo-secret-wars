import { createRenderer as createPhase9Renderer } from './renderer7a-visual.js?v=v098-csw-runtime-clean-1';

const HUANCAVELICA_ID='huancavelica';
const LEGACY_COLLISION_PRESET='islands';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const hash=text=>{let h=2166136261;for(const c of String(text)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
const isHuancavelica=room=>room?.terrainPreset===HUANCAVELICA_ID||room?.arena?.phase10Theme===HUANCAVELICA_ID;

function roomForLegacyRenderer(room){
  if(!isHuancavelica(room))return room;
  return{...room,terrainPreset:LEGACY_COLLISION_PRESET,arena:room.arena?{...room.arena,terrainPreset:LEGACY_COLLISION_PRESET,terrainName:'Huancavelica Simulator'}:room.arena};
}

export function createRenderer(canvas,config){
  const base=createPhase9Renderer(canvas,config);
  const overlay=document.createElement('canvas');
  overlay.width=canvas.width;overlay.height=canvas.height;overlay.setAttribute('aria-hidden','true');
  Object.assign(overlay.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none',zIndex:'1'});
  canvas.parentElement?.appendChild(overlay);
  const ctx=overlay.getContext('2d');let room=null,frameId=null;
  const worldToScreen=(x,y,view)=>({x:(x-view.x)/view.width*overlay.width,y:(y-view.y)/view.height*overlay.height});
  const pxScale=view=>overlay.width/view.width;

  function cloud(x,y,s=1){
    ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle='rgba(255,255,255,.97)';ctx.strokeStyle='rgba(105,148,185,.18)';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(-46,10,23,0,Math.PI*2);ctx.arc(-20,-4,32,0,Math.PI*2);ctx.arc(14,-8,29,0,Math.PI*2);ctx.arc(43,8,22,0,Math.PI*2);ctx.roundRect(-66,4,132,36,18);ctx.fill();ctx.stroke();ctx.restore();
  }
  function mountain(cx,base,w,h,near=false){
    const top=base-h;ctx.save();ctx.fillStyle=near?'#4d7da6':'#739fbd';ctx.beginPath();ctx.moveTo(cx-w/2,base);ctx.lineTo(cx,top);ctx.lineTo(cx+w/2,base);ctx.closePath();ctx.fill();
    ctx.fillStyle=near?'#f7fcff':'#eef7fb';ctx.beginPath();ctx.moveTo(cx,top);ctx.lineTo(cx-w*.14,top+h*.30);ctx.lineTo(cx-w*.045,top+h*.24);ctx.lineTo(cx+w*.035,top+h*.35);ctx.lineTo(cx+w*.13,top+h*.27);ctx.lineTo(cx+w*.20,top+h*.40);ctx.closePath();ctx.fill();
    ctx.fillStyle='rgba(38,84,122,.20)';ctx.beginPath();ctx.moveTo(cx,top);ctx.lineTo(cx+w*.5,base);ctx.lineTo(cx+w*.08,top+h*.39);ctx.closePath();ctx.fill();ctx.restore();
  }
  function forest(y,alpha,step=24){
    ctx.save();ctx.globalAlpha=alpha;for(let x=-45;x<overlay.width+70;x+=step){const h=42+((x*17)%58+58)%58;ctx.fillStyle='#164c3d';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+9,y-h);ctx.lineTo(x+18,y);ctx.closePath();ctx.fill();ctx.fillStyle='#286248';ctx.beginPath();ctx.moveTo(x+2,y-12);ctx.lineTo(x+9,y-h*.70);ctx.lineTo(x+16,y-12);ctx.closePath();ctx.fill();}ctx.restore();
  }
  function backdrop(){
    const sky=ctx.createLinearGradient(0,0,0,overlay.height);sky.addColorStop(0,'#168ee1');sky.addColorStop(.50,'#56b9e8');sky.addColorStop(1,'#c4e6f3');ctx.fillStyle=sky;ctx.fillRect(0,0,overlay.width,overlay.height);
    const sx=overlay.width*.84,sy=overlay.height*.10,glow=ctx.createRadialGradient(sx,sy,10,sx,sy,150);glow.addColorStop(0,'rgba(255,252,205,.98)');glow.addColorStop(.30,'rgba(255,236,128,.36)');glow.addColorStop(1,'rgba(255,236,128,0)');ctx.fillStyle=glow;ctx.fillRect(sx-170,sy-170,340,340);ctx.fillStyle='#fffbd8';ctx.beginPath();ctx.arc(sx,sy,34,0,Math.PI*2);ctx.fill();
    cloud(overlay.width*.18,overlay.height*.10,1.05);cloud(overlay.width*.66,overlay.height*.11,.88);cloud(overlay.width*.91,overlay.height*.26,.62);cloud(overlay.width*.45,overlay.height*.29,.40);
    const by=overlay.height*.93;mountain(overlay.width*.20,by,520,380,false);mountain(overlay.width*.42,by,660,500,true);mountain(overlay.width*.65,by,560,420,false);mountain(overlay.width*.83,by,620,475,true);forest(overlay.height*.83,.17,32);forest(overlay.height*.91,.32,27);forest(overlay.height*.98,.52,22);
  }

  function craterDelta(platform,x){let delta=0;for(const crater of room?.arena?.craters??[]){const dx=Math.abs(x-Number(crater.x)),r=Number(crater.radius??0),cy=Number(crater.y);if(dx>=r||r<=0)continue;if(Number.isFinite(cy)&&Math.abs(cy-platform.y)>260)continue;delta+=Number(crater.depth??0)*Math.sqrt(Math.max(0,1-(dx/r)**2));}return delta;}
  const platformTopY=(platform,x)=>Number(platform.y)+craterDelta(platform,x);
  function sampledTop(platform,view){const left=worldToScreen(platform.x1,platform.y,view).x,right=worldToScreen(platform.x2,platform.y,view).x,width=Math.max(1,right-left),n=Math.max(12,Math.ceil(width/16)),pts=[];for(let i=0;i<=n;i++){const wx=platform.x1+(platform.x2-platform.x1)*(i/n);pts.push(worldToScreen(wx,platformTopY(platform,wx),view));}return{left,right,width,pts,avg:pts.reduce((a,p)=>a+p.y,0)/pts.length};}

  function boulder(x,y,r,seed,bright=false){
    const wobble=.82+((seed>>>4)%18)/100;ctx.save();ctx.translate(x,y);ctx.scale(1,wobble);const g=ctx.createRadialGradient(-r*.32,-r*.38,r*.15,0,0,r);g.addColorStop(0,bright?'#ad8756':'#8b6948');g.addColorStop(.44,bright?'#7e5b3d':'#624731');g.addColorStop(1,'#302820');ctx.fillStyle=g;ctx.strokeStyle='rgba(40,30,23,.65)';ctx.lineWidth=Math.max(1,r*.11);ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='rgba(230,192,124,.15)';ctx.beginPath();ctx.arc(-r*.27,-r*.33,r*.30,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  function grassCap(pts,scale,seed){
    ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#224b24';ctx.lineWidth=Math.max(7,18*scale);ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(const p of pts.slice(1))ctx.lineTo(p.x,p.y);ctx.stroke();ctx.strokeStyle='#4f8d2d';ctx.lineWidth=Math.max(5,13*scale);ctx.stroke();ctx.strokeStyle='#8cc83d';ctx.lineWidth=Math.max(2,7*scale);ctx.stroke();ctx.strokeStyle='#c2e35c';ctx.lineWidth=Math.max(1,2.2*scale);ctx.stroke();
    for(let i=0;i<pts.length;i+=2){const p=pts[i];for(let b=0;b<4;b++){const h=(4+((seed+i*13+b*7)%8))*scale;ctx.strokeStyle=b%2?'#55942e':'#79ae36';ctx.lineWidth=Math.max(1,1.3*scale);ctx.beginPath();ctx.moveTo(p.x+(b-1.5)*2,p.y-2);ctx.lineTo(p.x+(b-2)*3,p.y-h);ctx.stroke();}}
    ctx.restore();
  }
  function islandOutline(platform,view){
    const scale=pxScale(view),s=sampledTop(platform,view),seed=hash(platform.id),depth=Math.max(platform.kind==='cliff'?120:72,platform.depth*scale),cx=(s.left+s.right)/2;
    const lower=[];if(platform.kind==='cliff'){
      const count=Math.max(7,Math.floor(s.width/65));for(let i=count;i>=0;i--){const t=i/count,x=s.left+s.width*t,edge=Math.abs(t-.5)*2,y=s.avg+depth*(.68+.28*(1-edge*.35)+(((seed+i*97)%31)/100));lower.push({x,y});}
    }else{
      lower.push({x:s.right,y:s.avg+depth*.38},{x:cx+s.width*.32,y:s.avg+depth*.58},{x:cx+s.width*.20,y:s.avg+depth*.77},{x:cx+s.width*.08,y:s.avg+depth*.93},{x:cx,y:s.avg+depth},{x:cx-s.width*.10,y:s.avg+depth*.90},{x:cx-s.width*.22,y:s.avg+depth*.75},{x:cx-s.width*.34,y:s.avg+depth*.56},{x:s.left,y:s.avg+depth*.39});
    }
    return{...s,scale,seed,depth,lower};
  }
  function drawIsland(platform,view){
    const o=islandOutline(platform,view);if(o.right<-160||o.left>overlay.width+160)return;ctx.save();ctx.beginPath();ctx.moveTo(o.pts[0].x,o.pts[0].y);for(const p of o.pts.slice(1))ctx.lineTo(p.x,p.y);for(const p of o.lower)ctx.lineTo(p.x,p.y);ctx.closePath();ctx.clip();
    const cols=Math.max(4,Math.ceil(o.width/48)),rows=Math.max(3,Math.ceil(o.depth/38));for(let row=0;row<rows;row++){for(let col=0;col<cols;col++){const v=(o.seed+row*1619+col*7919)>>>0,t=(col+.5+(row%2)*.32)/cols,x=o.left+t*o.width,y=o.avg+20+row*(o.depth*.78/rows)+(((v>>>7)%17)-8),edge=Math.abs(t-.5)*2,rr=(15+((v>>>16)%18))*clamp(o.scale*.95,.55,1.20)*(1-edge*.13);boulder(x,y,rr,v,(row+col)%5===0);}}
    const shade=ctx.createLinearGradient(0,o.avg,0,o.avg+o.depth);shade.addColorStop(0,'rgba(68,43,27,0)');shade.addColorStop(1,'rgba(21,20,18,.45)');ctx.fillStyle=shade;ctx.fillRect(o.left,o.avg,o.width,o.depth+20);ctx.restore();grassCap(o.pts,o.scale,o.seed);
  }

  function pine(x,y,s=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle='#704525';ctx.fillRect(-4,-33,8,34);const colors=['#173f2d','#1f5a35','#2e753d','#458d43'];for(let i=0;i<5;i++){const yy=-82+i*14,w=16+i*7;ctx.fillStyle=colors[i%colors.length];ctx.beginPath();ctx.moveTo(0,yy-20);ctx.lineTo(-w,yy+17);ctx.quadraticCurveTo(0,yy+10,w,yy+17);ctx.closePath();ctx.fill();}ctx.restore();}
  function bush(x,y,s=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);for(let i=0;i<7;i++){ctx.fillStyle=i%3===0?'#2b6a31':i%3===1?'#3f8337':'#5a963b';ctx.beginPath();ctx.arc((i-3)*5,-5-(i%2)*4,9,0,Math.PI*2);ctx.fill();}ctx.restore();}
  function fence(x,y,s=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.strokeStyle='#5c371f';ctx.lineWidth=5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-25,1);ctx.lineTo(-25,-27);ctx.moveTo(25,1);ctx.lineTo(25,-27);ctx.moveTo(-29,-19);ctx.lineTo(29,-19);ctx.moveTo(-29,-7);ctx.lineTo(29,-7);ctx.stroke();ctx.strokeStyle='#a97438';ctx.lineWidth=1.5;ctx.stroke();ctx.restore();}
  function sign(x,y,s=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle='#60401f';ctx.fillRect(-3,-30,6,30);ctx.fillStyle='#b67834';ctx.strokeStyle='#4f2f19';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(-18,-38,34,15,3);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(16,-38);ctx.lineTo(26,-30.5);ctx.lineTo(16,-23);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();}
  function crate(x,y,s=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle='#9a622e';ctx.strokeStyle='#5a351b';ctx.lineWidth=2.5;ctx.fillRect(-14,-27,28,27);ctx.strokeRect(-14,-27,28,27);ctx.beginPath();ctx.moveTo(-12,-25);ctx.lineTo(12,-2);ctx.moveTo(12,-25);ctx.lineTo(-12,-2);ctx.stroke();ctx.restore();}
  function flowers(x,y,s=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);for(let i=0;i<7;i++){const px=-16+i*5.3;ctx.strokeStyle='#3d792f';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(px,0);ctx.lineTo(px,-8-(i%3));ctx.stroke();ctx.fillStyle=i%3===0?'#ffd84e':i%3===1?'#ff7587':'#f4efff';ctx.beginPath();ctx.arc(px,-9-(i%3),2.5,0,Math.PI*2);ctx.fill();}ctx.restore();}
  function vines(platform,view){const seed=hash(platform.id);if(platform.kind!=='cliff'&&seed%3!==0)return;const scale=pxScale(view),wx=platform.x1+(platform.x2-platform.x1)*(.18+(seed%48)/100),p=worldToScreen(wx,platformTopY(platform,wx),view);ctx.save();ctx.strokeStyle='rgba(42,105,43,.92)';ctx.lineWidth=Math.max(1.5,3.2*scale);ctx.beginPath();ctx.moveTo(p.x,p.y);for(let i=1;i<7;i++)ctx.quadraticCurveTo(p.x+(i%2?13:-10)*scale,p.y+i*23*scale,p.x+(i%2?5:-4)*scale,p.y+i*27*scale);ctx.stroke();ctx.restore();}
  function timberFrame(platform,view){if(platform.kind!=='cliff'||hash(platform.id)%2)return;const scale=clamp(5000/view.width*.55,.35,1.1),w=platform.x2-platform.x1,xw=platform.x1+w*.62,p=worldToScreen(xw,platformTopY(platform,xw),view);ctx.save();ctx.translate(p.x,p.y);ctx.scale(scale,scale);ctx.strokeStyle='#624021';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(-38,0);ctx.lineTo(-38,58);ctx.moveTo(38,0);ctx.lineTo(38,58);ctx.moveTo(-43,5);ctx.lineTo(43,5);ctx.moveTo(-38,58);ctx.lineTo(38,5);ctx.moveTo(38,58);ctx.lineTo(-38,5);ctx.stroke();ctx.restore();}
  function decorate(platform,view){
    const scale=clamp(5000/view.width*.58,.34,1.18),seed=hash(platform.id),w=platform.x2-platform.x1,top=x=>worldToScreen(x,platformTopY(platform,x),view);
    if(w>500){const p1=top(platform.x1+w*(.18+(seed%16)/100));pine(p1.x,p1.y-2,scale*(platform.kind==='cliff'?1.06:.86));if(platform.kind==='cliff'&&w>700){const p2=top(platform.x1+w*.82);pine(p2.x,p2.y-2,scale*.92);}}
    if(w>360){const b=top(platform.x1+w*.42);bush(b.x,b.y-2,scale*.72);}if(w>560){const f=top(platform.x1+w*.68);fence(f.x,f.y-1,scale*.72);}if(seed%4===0){const s=top(platform.x1+w*.53);sign(s.x,s.y-1,scale*.72);}if(seed%6===0&&w>420){const c=top(platform.x1+w*.80);crate(c.x,c.y-1,scale*.68);}const fl=top(clamp((platform.x1+platform.x2)/2+((seed%140)-70),platform.x1+32,platform.x2-32));flowers(fl.x,fl.y-1,scale*.78);vines(platform,view);timberFrame(platform,view);
  }
  function platforms(view){const ps=room?.arena?.platforms??[];for(const p of [...ps].sort((a,b)=>Number(b.y)-Number(a.y)))drawIsland(p,view);for(const p of ps)decorate(p,view);}

  function voidHaze(){const g=ctx.createLinearGradient(0,overlay.height*.78,0,overlay.height);g.addColorStop(0,'rgba(20,60,68,0)');g.addColorStop(1,'rgba(7,23,30,.46)');ctx.fillStyle=g;ctx.fillRect(0,overlay.height*.76,overlay.width,overlay.height*.24);}
  function title(){if(!['lobby','countdown'].includes(room?.status))return;ctx.save();ctx.fillStyle='rgba(12,39,57,.88)';ctx.beginPath();ctx.roundRect(22,20,355,78,12);ctx.fill();ctx.fillStyle='#fff';ctx.font='900 22px ui-monospace,monospace';ctx.fillText('HUANCAVELICA SIMULATOR',42,53);ctx.fillStyle='#d9efff';ctx.font='800 12px ui-monospace,monospace';ctx.fillText('ALPINE RIDGE // EXPERIMENTAL',42,80);ctx.restore();}

  function loop(){ctx.clearRect(0,0,overlay.width,overlay.height);if(room?.arena&&isHuancavelica(room)){const view=base.getViewSnapshot?.();if(view){backdrop();platforms(view);voidHaze();title();}}frameId=requestAnimationFrame(loop);}
  frameId=requestAnimationFrame(loop);
  return Object.freeze({
    drawScaffold(){room=null;ctx.clearRect(0,0,overlay.width,overlay.height);base.drawScaffold();},
    drawArena(nextRoom,nextLocalPlayerId=null){room=nextRoom;base.drawArena(roomForLegacyRenderer(nextRoom),nextLocalPlayerId);},
    getViewSnapshot(){return base.getViewSnapshot?.()??null;},
    destroy(){if(frameId)cancelAnimationFrame(frameId);frameId=null;overlay.remove();base.destroy?.();}
  });
}

export const phase10HuancavelicaVisualTestHooks=Object.freeze({isHuancavelica,roomForLegacyRenderer});
