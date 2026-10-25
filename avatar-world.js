// Presentation only: never writes to authoritative room/player objects.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t;
const STEP=5000/1448;
export function createAvatarWorld({isSolid=()=>false}={}){
 const bodies=new Map(),particles=[];let scope=null,disposed=false;
 function clear(){bodies.clear();particles.length=0;scope=null;}
 function surface(room,x,feet,air){
  let y=feet-24,previous=isSolid(room,x,y);
  const end=feet+(air?210:45);
  for(y+=STEP;y<=end;y+=STEP){
   const solid=isSolid(room,x,y);
   if(solid&&!previous)return y;
   previous=solid;
  }return null;
 }
 function emit(x,y,now,count,strength=1,direction=0){
  for(let i=0;i<count;i++){
   const n=(i+1)*2.399963,spread=Math.sin(n);
   particles.push({x,y,born:now,vx:spread*(35+strength*35)-direction*20,vy:-35-Math.abs(Math.cos(n))*strength*65,size:1.3+(i%3)*.6,life:430+(i%4)*60,leaf:i%4===0});
  }
  if(particles.length>64)particles.splice(0,particles.length-64);
 }
 function update(player,pos,room,now){
  if(disposed)return {motion:{},contacts:[],grounded:false};
  const nextScope=room?.code??room?.arena?.id??'arena';
  if(scope!==nextScope){clear();scope=nextScope;}
  const id=String(player.id),facing=pos.facing||1,air=Boolean(player.airborne||(player.motion&&now<player.motion.endsAt&&player.motion.type!=='move'));
  let s=bodies.get(id);
  const feet=pos.y+8,lastCut=room.arena?.craters?.at(-1),stamp=[room.arena?.craters?.length??0,lastCut?.id??'',lastCut?.radius??0,lastCut?.x??0,lastCut?.y??0].join(':');
  if(!s||now-s.at>300||Math.hypot(pos.x-s.x,pos.y-s.y)>250){
   const phase=[...id].reduce((a,c)=>a+c.charCodeAt(0),0);
   s={x:pos.x,y:pos.y,at:now,vx:0,vy:0,air,wheel:0,travel:0,pitch:0,lean:0,landing:0,landedAt:-10000,lastDust:now,phase,groundAt:-10000,contacts:[]};
   bodies.set(id,s);
  }
  const dt=clamp((now-s.at)/1000,0,.05),dx=pos.x-s.x;
  const vx=dt?lerp(s.vx,clamp(dx/dt,-1600,1600),Math.min(1,dt*15)):s.vx;
  const vy=player.airborne?.vy??(dt?(pos.y-s.y)/dt:0);
  if(now-s.groundAt>=65||s.stamp!==stamp){
   s.contacts=[-52,0,52].map(offset=>{const x=pos.x+offset,y=surface(room,x,feet,air);return y==null?null:{x,y,gap:y-feet};});
   s.groundAt=now;s.stamp=stamp;
  }
  const contacts=s.contacts.map((p,i)=>p?{...p,x:pos.x+[-52,0,52][i],gap:p.y-feet}:null);
  const supports=contacts.filter(p=>p&&Math.abs(p.gap)<22),grounded=!air&&supports.length>0;
  if(s.air&&!air&&grounded){
   s.landing=clamp(Math.abs(s.vy)/1400,.25,1);s.landedAt=now;
   emit(pos.x,feet,now,8,s.landing);
  }
  const [left,,right]=contacts;
  const slope=grounded&&left&&right&&Math.abs(left.gap)<30&&Math.abs(right.gap)<30?Math.atan2(right.y-left.y,104):0;
  const target=air?clamp(-vx/2500+vy/12000*facing,-.18,.18):clamp(slope,-.15,.15);
  s.pitch=lerp(s.pitch,target,Math.min(1,dt*12));
  const acceleration=dt?(vx-s.vx)/dt:0;
  s.lean=lerp(s.lean,clamp(-acceleration/45000,-.035,.035)*facing,Math.min(1,dt*10));
  s.wheel=(s.wheel+dx/22*facing)%(Math.PI*2);s.travel+=Math.abs(dx);
  if(grounded&&Math.abs(vx)>45&&now-s.lastDust>=100){
   const rear=vx>0?left:right;if(rear){emit(rear.x,rear.y,now,2,.3,Math.sign(vx));s.lastDust=now;}
  }
  const age=Math.max(0,(now-s.landedAt)/1000),spring=s.landing*Math.exp(-age*9)*Math.cos(age*21);
  const motion={pitch:s.pitch,squash:1-spring*.065,wheel:s.wheel,
   riderBob:Math.sin(now*.003+s.phase)*.65+(grounded?Math.sin(s.travel*.16)*Math.min(1.5,Math.abs(vx)/280):0)-spring*3,
   riderLean:s.lean,riderBreath:1+Math.sin(now*.003+s.phase)*.008};
  Object.assign(s,{x:pos.x,y:pos.y,at:now,vx,vy,air});
  for(let i=particles.length-1;i>=0;i--)if(now-particles[i].born>particles[i].life)particles.splice(i,1);
  return {motion,contacts,grounded,feet,now};
 }
 function prune(ids){const keep=new Set(ids.map(String));for(const id of bodies.keys())if(!keep.has(id))bodies.delete(id);}
 return Object.freeze({update,prune,clear,particles,dispose(){clear();disposed=true;},get size(){return bodies.size;}});
}
export function drawAvatarGrounding(ctx,frame,project,pxX,pxY){
 const center=frame.contacts[1],supports=frame.contacts.filter(p=>p&&p.gap>=-20&&p.gap<210);
 ctx.save();
 if(center&&center.gap>=-20&&center.gap<210){
  const p=project(center.x,center.y),fade=clamp(1-Math.max(0,center.gap)/210,0,1);
  for(const [spread,alpha]of [[1.2,.045],[1,.065],[.7,.09]]){
   ctx.fillStyle='rgba(13,30,17,'+(alpha*fade)+')';ctx.beginPath();ctx.ellipse(p.x,p.y+pxY,55*pxX*spread,4*pxY*spread,0,0,Math.PI*2);ctx.fill();
  }
 }
 if(frame.grounded)for(const contact of supports){
  if(Math.abs(contact.gap)>22)continue;
  const p=project(contact.x,contact.y);ctx.fillStyle='rgba(8,20,10,.24)';ctx.beginPath();ctx.ellipse(p.x,p.y+pxY,13*pxX,2.2*pxY,0,0,Math.PI*2);ctx.fill();
 }
 ctx.restore();
}
export function drawAvatarContactForeground(ctx,frame,project,baseCanvas,pxX,pxY){
 if(!frame.grounded)return;
 for(const contact of frame.contacts){
  if(!contact||Math.abs(contact.gap)>15)continue;
  const p=project(contact.x,contact.y),x=Math.max(0,p.x-12*pxX),y=Math.max(0,p.y-.6),w=Math.min(24*pxX,baseCanvas.width-x),h=Math.min(3.5*pxY,baseCanvas.height-y);
  if(w<=0||h<=0)continue;
  ctx.save();ctx.beginPath();ctx.ellipse(p.x,p.y+1.4*pxY,12*pxX,2.3*pxY,0,0,Math.PI*2);ctx.clip();
  ctx.drawImage(baseCanvas,x,y,w,h,x,y,w,h);ctx.restore();
 }
}
export function drawAvatarDust(ctx,particles,now,project,pxX,pxY){
 for(const p of particles){
  const age=(now-p.born)/1000,t=(now-p.born)/p.life;if(t<0||t>=1)continue;
  const s=project(p.x+p.vx*age,p.y+p.vy*age+120*age*age);
  ctx.save();ctx.globalAlpha=(1-t)*.38;ctx.fillStyle=p.leaf?'#799b3b':'#bca97b';ctx.beginPath();ctx.ellipse(s.x,s.y,p.size*pxX*(1+t*.7),p.size*pxY,age*3,0,Math.PI*2);ctx.fill();ctx.restore();
 }
}
