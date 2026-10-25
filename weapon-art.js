import {ARSENAL_ART} from './assets/arsenal-v1/manifest.js?v=pickup-spin-20261025';
import {avatarLayout} from './mini-avatar.js?v=somber-v1-20261025';
export const WEAPON_COLORS=Object.freeze({basic:'#d6b778',heavy:'#d3975c',triple:'#9cc9cb',cluster:'#bc929e',child:'#bc929e',airstrike:'#d6a363',airbomb:'#d6a363',nuke:'#c6a1df',shield:'#87c3bb',heal:'#b3dcae'});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Match the complete rider/vehicle width at every camera zoom, never its collider.
export function weaponVisualSize(appearance,pxX,pxY,role){
 const layout=avatarLayout(appearance);
 return (layout.right-layout.left)*Math.max(pxX,pxY)*(role==='pickup'?.8:.5);
}
export function weaponSpriteHeight(type,size){
 const [,,w,h]=ARSENAL_ART.frames[type].source;
 return type==='triple'?size*(.34+.86*h/w):size*h/Math.max(w,h);
}
let art=null,loading=null;
export function loadWeaponArt(){
 if(loading)return loading;if(typeof Image==='undefined')return Promise.resolve(null);
 loading=Promise.all(['objects','impact'].map(key=>new Promise((resolve,reject)=>{
  const image=new Image();image.decoding='async';image.onload=()=>{
   const expected=key==='objects'?ARSENAL_ART:ARSENAL_ART.impact;
   if(image.naturalWidth!==expected.width||image.naturalHeight!==expected.height){reject(new Error('Invalid arsenal '+key+' atlas'));return;}
   resolve([key,image]);
  };image.onerror=()=>reject(new Error('Could not load arsenal '+key));
  image.src=new URL('./assets/arsenal-v1/'+key+'.png?v='+ARSENAL_ART.version,import.meta.url).href;
 }))).then(entries=>(art=Object.fromEntries(entries)));return loading;
}
// All angles are screen-space tangents. Sprite size never changes collision.
export function drawWeaponSprite(ctx,type,x,y,{size=42,angle=0,icon=false}={},images=art){
 const frame=ARSENAL_ART.frames[type];if(!images?.objects||!frame)return false;
 const [sx,sy,sw,sh]=frame.source,ratio=size/Math.max(sw,sh),w=sw*ratio,h=sh*ratio;
 ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.imageSmoothingEnabled=true;
 if(type==='triple'&&icon){for(const [dx,dy]of [[-size*.07,-size*.17],[0,0],[size*.07,size*.17]])ctx.drawImage(images.objects,sx,sy,sw,sh,-w*.43+dx,-h*.43+dy,w*.86,h*.86);}
 else ctx.drawImage(images.objects,sx,sy,sw,sh,-w/2,-h/2,w,h);
 ctx.restore();return true;
}
export function projectileVisualPose(shot,now,view,width,height){
 const span=Math.max(1,shot.durationMs??(shot.impactAt-shot.startedAt)),seconds=clamp(now-shot.startedAt,0,span)/1000;
 const vx=(shot.vx??0)+(shot.windAccel??0)*seconds,vy=(shot.vy??0)+(shot.gravity??0)*seconds;
 const x=shot.startX+(shot.vx??0)*seconds+.5*(shot.windAccel??0)*seconds**2,y=shot.startY+(shot.vy??0)*seconds+.5*(shot.gravity??0)*seconds**2;
 return{x:(x-view.x)/view.width*width,y:(y-view.y)/view.height*height,angle:Math.atan2(vy*height/view.height,vx*width/view.width)};
}
export function drawWeaponTrail(ctx,points,type,scale=1){
 if(points.length<2)return;ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=WEAPON_COLORS[type]??WEAPON_COLORS.basic;ctx.lineWidth=clamp(2.2*scale,1,3.2);ctx.globalAlpha=.36;
 ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
 // Low-contrast ash marks stay behind the projectile, leaving its shape clear.
 ctx.fillStyle='#82786b';ctx.globalAlpha=.16;
 for(let i=2;i<points.length-2;i+=5){const p=points[i];ctx.beginPath();ctx.ellipse(p.x,p.y,3.4*scale,2.2*scale,0,0,Math.PI*2);ctx.fill();}
 ctx.restore();
}
export function drawWeaponImpact(ctx,type,x,y,age,{scale=1,mult=1}={},images=art){
 if(age<0||age>=900||!images?.impact)return false;
 const progress=age/900,index=Math.min(3,Math.floor(progress*4)),blend=progress*4-index;
 const size=clamp(128*scale*mult,48,240),height=size*ARSENAL_ART.impact.height/512;
 ctx.save();ctx.translate(x,y);
 for(const [i,alpha]of [[index,1-blend],[Math.min(3,index+1),blend]]){
  if(alpha<=0)continue;ctx.globalAlpha=alpha*(1-progress*.55);
  ctx.drawImage(images.impact,...ARSENAL_ART.impact.frames[i],-size*.5,-height*.80,size,height);
 }
 ctx.restore();return true;
}
export function drawPickupVisual(ctx,type,x,y,size,now){
 const cy=y-weaponSpriteHeight(type,size)/2,phase=now/4200*Math.PI*2+Object.keys(ARSENAL_ART.frames).indexOf(type)*.73;
 const turn=Math.cos(phase),pulse=.88+.12*Math.sin(phase*2),color=WEAPON_COLORS[type]??WEAPON_COLORS.basic;
 ctx.save();ctx.fillStyle='rgba(3,5,8,.36)';ctx.beginPath();ctx.ellipse(x,y+2,size*.32,size*.045,0,0,Math.PI*2);ctx.fill();
 // A soft backlight stays readable even while the sprite turns edge-on.
 ctx.translate(x,cy);ctx.save();ctx.scale(1,.78);
 const glow=ctx.createRadialGradient(0,0,size*.04,0,0,size*.65);
 glow.addColorStop(0,color+'38');glow.addColorStop(.45,color+'18');glow.addColorStop(1,color+'00');
 ctx.globalAlpha=pulse;ctx.fillStyle=glow;ctx.beginPath();ctx.arc(0,0,size*.65,0,Math.PI*2);ctx.fill();ctx.restore();
 // Retro coin turn, with a small readable edge and the original untinted texture.
 ctx.scale((turn<0?-1:1)*(.18+.82*Math.abs(turn)),1);
 ctx.shadowColor=color+'75';ctx.shadowBlur=Math.min(8,size*.045);
 const drawn=drawWeaponSprite(ctx,type,0,0,{size,icon:true});ctx.restore();return drawn;
}
export function drawTargetBeacon(ctx,type,x,y,size,now){
 drawWeaponSprite(ctx,type,x,y-size*.35,{size});
 ctx.save();ctx.strokeStyle=WEAPON_COLORS[type];ctx.globalAlpha=.45+.15*Math.sin(now/130);ctx.lineWidth=1.8;
 for(const d of [-1,1]){ctx.beginPath();ctx.moveTo(x+d*size*.55,y);ctx.lineTo(x+d*size*.30,y);ctx.moveTo(x,y+d*size*.35);ctx.lineTo(x,y+d*size*.15);ctx.stroke();}ctx.restore();
}
export function drawShieldVisual(ctx,player,room,bounds,now){
 const q=room.match?.projectile,covered=player.shield||(now<=(q?.resolveAt??0)&&q?.shieldedPlayerIds?.includes(player.id));
 if(!covered||player.alive===false)return false;
 const x=(bounds.left+bounds.right)/2,y=(bounds.top+bounds.bottom)/2,w=Math.max(40,(bounds.right-bounds.left)*.62),h=Math.max(35,(bounds.bottom-bounds.top)*.60);
 ctx.save();ctx.beginPath();ctx.ellipse(x,y,w,h,0,0,Math.PI*2);ctx.fillStyle='rgba(65,149,142,.08)';ctx.fill();ctx.strokeStyle='rgba(126,205,194,.65)';ctx.lineWidth=2;ctx.stroke();ctx.clip();
 const r=clamp(w/5,10,26);ctx.strokeStyle='rgba(112,194,185,.18)';ctx.lineWidth=1;
 for(let row=-4;row<=4;row++)for(let col=-5;col<=5;col++){
  const cx=x+col*r*1.73+(row%2?r*.865:0),cy=y+row*r*1.5;ctx.beginPath();
  for(let i=0;i<6;i++){const a=(i*60-30)*Math.PI/180,px=cx+Math.cos(a)*r,py=cy+Math.sin(a)*r;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.stroke();
 }
 const hitAge=now-(player.lastDamage?.at??-Infinity);
 if(hitAge>=0&&hitAge<400){ctx.globalAlpha=1-hitAge/400;ctx.strokeStyle='#d9ebe3';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(x,y,w*.98,h*.98,0,0,Math.PI*2);ctx.stroke();}
 ctx.restore();return true;
}
export function drawHealVisual(ctx,player,bounds,now){
 const event=player.lastUtility,age=now-(event?.at??-Infinity);if(event?.type!=='heal'||age<0||age>=1300)return false;
 const t=age/1300,x=(bounds.left+bounds.right)/2,y=bounds.bottom-4,w=(bounds.right-bounds.left)*.60;
 ctx.save();ctx.globalAlpha=(1-t)*.75;ctx.strokeStyle='#b0dca9';ctx.lineWidth=2.4;ctx.beginPath();ctx.ellipse(x,y,w*(.65+t*.35),8+t*5,0,0,Math.PI*2);ctx.stroke();
 ctx.fillStyle='#b0dca9';for(let i=0;i<6;i++){const px=x+Math.sin(i*2.4)*w*.75,py=y-15-t*(45+i*8);ctx.fillRect(px-1.5,py-5,3,10);ctx.fillRect(px-5,py-1.5,10,3);}
 ctx.font='800 16px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText('+'+(event.amount??20),x,bounds.top-72-t*18);ctx.restore();return true;
}
export function drawWeaponIcon(canvas,type){
 const draw=()=>{if(!canvas.isConnected)return;const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);drawWeaponSprite(c,type,canvas.width/2,canvas.height/2,{size:Math.min(canvas.width,canvas.height)-4,icon:true});};
 draw();return loadWeaponArt().then(draw);
}
