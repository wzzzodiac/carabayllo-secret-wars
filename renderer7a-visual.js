import { createRenderer as createPhase6fRenderer } from './renderer6f.js?v=phase7a-afk-panel-1';

export function createRenderer(canvas, config) {
  const base=createPhase6fRenderer(canvas,config);
  const overlay=document.createElement('canvas');
  overlay.width=canvas.width;overlay.height=canvas.height;overlay.setAttribute('aria-hidden','true');
  Object.assign(overlay.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none',zIndex:'5'});
  canvas.parentElement?.appendChild(overlay);
  const ctx=overlay.getContext('2d');
  let room=null,frameId=null;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const lerp=(a,b,t)=>a+(b-a)*t;
  const COLORS={basic:'#fff0a8',heavy:'#ffad5c',triple:'#b5f2ff',cluster:'#ffb5d8',nuke:'#f3b0ff',airstrike:'#ffd58a'};
  function worldToScreen(x,y,view){return{x:(x-view.x)/view.width*overlay.width,y:(y-view.y)/view.height*overlay.height};}
  function ballisticPosition(p,now=Date.now()){
    if(!p)return null;
    const duration=Math.max(1,p.durationMs??(p.impactAt-p.startedAt)??1),elapsed=clamp(now-p.startedAt,0,duration)/1000;
    return{x:p.startX+(p.vx??0)*elapsed+.5*(p.windAccel??0)*elapsed*elapsed,y:p.startY+(p.vy??0)*elapsed+.5*(p.gravity??0)*elapsed*elapsed};
  }
  function drawGlowOrb(screen,color,size=13){ctx.save();ctx.globalCompositeOperation='lighter';ctx.shadowColor=color;ctx.shadowBlur=34;ctx.fillStyle=color;ctx.beginPath();ctx.arc(screen.x,screen.y,size,0,Math.PI*2);ctx.fill();ctx.shadowBlur=12;ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(screen.x,screen.y,Math.max(4,size*.36),0,Math.PI*2);ctx.fill();ctx.restore();}
  function drawMuzzleFlash(p,view,now,color){
    const untilLaunch=p.startedAt-now;
    if(untilLaunch>900||now-p.startedAt>550)return;
    const start=worldToScreen(p.startX,p.startY,view),pre=now<p.startedAt,age=pre?Math.max(0,900-untilLaunch):now-p.startedAt,fade=pre?.72:Math.max(0,1-age/550),pulse=.5+.5*Math.sin(now/45);
    ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=fade;ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=38;ctx.beginPath();ctx.arc(start.x,start.y,pre?12+5*pulse:12+22*fade,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(start.x,start.y,pre?5:5+8*fade,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  function drawImpactPulse(x,y,view,age,color,mult=1){
    if(age<0||age>900)return;
    const p=worldToScreen(x,y,view),t=age/900,fade=1-t,r=(16+t*72)*mult;
    ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.9*fade;ctx.strokeStyle=color;ctx.shadowColor=color;ctx.shadowBlur=26;ctx.lineWidth=Math.max(1,5-3*t);ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.stroke();ctx.fillStyle=color;ctx.globalAlpha=.22*fade;ctx.beginPath();ctx.arc(p.x,p.y,r*.72,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  function drawFullBallistic(p,view,now,color,size=13){
    if(!p)return;
    drawMuzzleFlash(p,view,now,color);
    if(now>=p.impactAt)return;
    const current=ballisticPosition(p,now);if(!current)return;
    const duration=Math.max(1,p.impactAt-p.startedAt),progress=clamp((now-p.startedAt)/duration,0,1);
    ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineCap='round';ctx.lineJoin='round';
    const samples=Math.max(2,Math.min(110,Math.ceil(progress*100))),points=[];
    for(let i=0;i<=samples;i++){const sampleAt=p.startedAt+duration*progress*(i/samples),q=ballisticPosition(p,sampleAt);points.push(worldToScreen(q.x,q.y,view));}
    if(points.length>1){ctx.shadowColor=color;ctx.shadowBlur=22;ctx.strokeStyle=color;ctx.globalAlpha=.54;ctx.lineWidth=7;ctx.beginPath();points.forEach((s,i)=>i?ctx.lineTo(s.x,s.y):ctx.moveTo(s.x,s.y));ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle='#ffffff';ctx.globalAlpha=.46;ctx.lineWidth=2;ctx.beginPath();points.forEach((s,i)=>i?ctx.lineTo(s.x,s.y):ctx.moveTo(s.x,s.y));ctx.stroke();}
    ctx.restore();drawGlowOrb(worldToScreen(current.x,current.y,view),color,size);
  }
  function drawClusterChildren(q,view,now){
    const color=COLORS.cluster;
    for(const child of q.clusterImpacts??[]){
      const startAt=child.visualStartAt??(q.impactAt+1000),end=child.impactAt;
      if(now>=end){drawImpactPulse(child.x,child.y,view,now-end,color,.72);continue;}
      if(now<startAt)continue;
      const raw=clamp((now-startAt)/Math.max(1,end-startAt),0,1),x=lerp(q.impactX,child.x,raw),y=lerp(q.impactY,child.y,raw)-Math.sin(Math.PI*raw)*190,p=worldToScreen(x,y,view),tailRaw=Math.max(0,raw-.18),tx=lerp(q.impactX,child.x,tailRaw),ty=lerp(q.impactY,child.y,tailRaw)-Math.sin(Math.PI*tailRaw)*190,t=worldToScreen(tx,ty,view);
      ctx.save();ctx.globalCompositeOperation='lighter';ctx.strokeStyle=color;ctx.shadowColor=color;ctx.shadowBlur=20;ctx.lineWidth=6;ctx.globalAlpha=.88;ctx.beginPath();ctx.moveTo(t.x,t.y);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.restore();drawGlowOrb(p,color,10);
    }
  }
  function drawAirStrike(q,view,now){
    for(const shell of q.airStrikeShells??[]){
      const startAt=shell.visualStartAt??(shell.impactAt-6000),end=shell.impactAt;
      if(now>=end){drawImpactPulse(shell.x,shell.y,view,now-end,COLORS.airstrike,.88);continue;}
      if(now<startAt)continue;
      const raw=clamp((now-startAt)/Math.max(1,end-startAt),0,1),eased=raw*raw*(3-2*raw),impact=worldToScreen(shell.x,shell.y,view),head={x:impact.x,y:lerp(-18,impact.y,eased)},tailProgress=Math.max(0,raw-.12),tailEase=tailProgress*tailProgress*(3-2*tailProgress),tail={x:impact.x,y:lerp(-18,impact.y,tailEase)};
      ctx.save();ctx.globalCompositeOperation='lighter';ctx.strokeStyle=COLORS.airstrike;ctx.shadowColor=COLORS.airstrike;ctx.shadowBlur=30;ctx.lineWidth=9;ctx.globalAlpha=.92;ctx.beginPath();ctx.moveTo(tail.x,tail.y);ctx.lineTo(head.x,head.y);ctx.stroke();ctx.strokeStyle='#fff';ctx.lineWidth=2.6;ctx.globalAlpha=.8;ctx.beginPath();ctx.moveTo(tail.x,tail.y);ctx.lineTo(head.x,head.y);ctx.stroke();ctx.restore();drawGlowOrb(head,COLORS.airstrike,12);
    }
  }
  function drawProjectilePresentation(activeRoom,view){
    const q=activeRoom?.match?.projectile;if(activeRoom?.status!=='started'||!q)return;
    const now=Date.now(),type=q.weaponType??'basic';
    if(type==='airstrike'){drawAirStrike(q,view,now);return;}
    if(type==='triple'&&q.volley?.length){for(const v of q.volley)drawFullBallistic(v,view,now,COLORS.triple,11);return;}
    drawFullBallistic(q,view,now,COLORS[type]??COLORS.basic,type==='heavy'?16:type==='cluster'?15:type==='nuke'?14:14);
    if(type==='cluster')drawClusterChildren(q,view,now);
  }
  function roomForBase(nextRoom){
    const q=nextRoom?.match?.projectile;if(!q)return nextRoom;
    if(q.weaponType==='airstrike')return{...nextRoom,match:{...nextRoom.match,projectile:{...q,airStrikeShells:[]}}};
    if(q.weaponType==='cluster')return{...nextRoom,match:{...nextRoom.match,projectile:{...q,clusterImpacts:[]}}};
    return nextRoom;
  }
  function loop(){ctx.clearRect(0,0,overlay.width,overlay.height);if(room?.arena){const view=base.getViewSnapshot?.();if(view)drawProjectilePresentation(room,view);}frameId=requestAnimationFrame(loop);}
  frameId=requestAnimationFrame(loop);
  return Object.freeze({drawScaffold(){room=null;ctx.clearRect(0,0,overlay.width,overlay.height);base.drawScaffold();},drawArena(nextRoom,nextLocalPlayerId=null){room=nextRoom;base.drawArena(roomForBase(nextRoom),nextLocalPlayerId);},getViewSnapshot(){return base.getViewSnapshot?.()??null;},destroy(){if(frameId)cancelAnimationFrame(frameId);frameId=null;overlay.remove();base.destroy?.();}});
}
