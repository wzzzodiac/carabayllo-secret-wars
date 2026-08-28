import { createRenderer as createPhase6fRenderer } from './renderer6f.js?v=phase7a-visual-base-1';

export function createRenderer(canvas, config) {
  const base=createPhase6fRenderer(canvas,config);
  const overlay=document.createElement('canvas');
  overlay.width=canvas.width;overlay.height=canvas.height;overlay.setAttribute('aria-hidden','true');
  Object.assign(overlay.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none',zIndex:'5'});
  canvas.parentElement?.appendChild(overlay);
  const ctx=overlay.getContext('2d');
  let room=null,frameId=null,lastProjectileId=null;
  const visualStarts=new Map();
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const lerp=(a,b,t)=>a+(b-a)*t;
  const COLORS={basic:'#fff0a8',heavy:'#ffad5c',triple:'#b5f2ff',cluster:'#ffb5d8',nuke:'#f3b0ff',airstrike:'#ffd58a'};
  const VISUAL_MS={basic:5000,heavy:6000,triple:6000,cluster:6000,nuke:6000};
  function worldToScreen(x,y,view){return{x:(x-view.x)/view.width*overlay.width,y:(y-view.y)/view.height*overlay.height};}
  function firstSeen(id,now){if(!id)return now;if(!visualStarts.has(id))visualStarts.set(id,now);return visualStarts.get(id);}
  function cleanupStarts(activeId){for(const key of visualStarts.keys())if(key!==activeId&&!String(key).startsWith(`${activeId}:`))visualStarts.delete(key);}
  function pointAtProgress(p,progress){const duration=Math.max(1,p.durationMs??(p.impactAt-p.startedAt)??1)/1000,t=clamp(progress,0,1)*duration;return{x:p.startX+(p.vx??0)*t+.5*(p.windAccel??0)*t*t,y:p.startY+(p.vy??0)*t+.5*(p.gravity??0)*t*t};}
  function drawGlowOrb(screen,color,size=11){ctx.save();ctx.globalCompositeOperation='lighter';ctx.shadowColor=color;ctx.shadowBlur=30;ctx.fillStyle=color;ctx.beginPath();ctx.arc(screen.x,screen.y,size,0,Math.PI*2);ctx.fill();ctx.shadowBlur=10;ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(screen.x,screen.y,Math.max(3,size*.35),0,Math.PI*2);ctx.fill();ctx.restore();}
  function drawMuzzleFlash(p,view,age,color){if(age>700)return;const start=worldToScreen(p.startX,p.startY,view),fade=1-age/700,pulse=.5+.5*Math.sin(age/45);ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.9*fade;ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=32;ctx.beginPath();ctx.arc(start.x,start.y,11+18*fade+5*pulse,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(start.x,start.y,5+7*fade,0,Math.PI*2);ctx.fill();ctx.restore();}
  function drawFullBallistic(p,view,now,color,size=11,visualKey=p?.id,visualMs=5000){
    if(!p)return;
    const seen=firstSeen(visualKey,now),age=now-seen,progress=clamp(age/visualMs,0,1),current=pointAtProgress(p,progress);
    drawMuzzleFlash(p,view,age,color);
    ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineCap='round';ctx.lineJoin='round';
    const samples=Math.max(12,Math.min(100,Math.ceil(progress*90))),points=[];
    for(let i=0;i<=samples;i++){const q=pointAtProgress(p,progress*(i/samples));points.push(worldToScreen(q.x,q.y,view));}
    if(points.length>1){ctx.shadowColor=color;ctx.shadowBlur=20;ctx.strokeStyle=color;ctx.globalAlpha=.52;ctx.lineWidth=6;ctx.beginPath();points.forEach((s,i)=>i?ctx.lineTo(s.x,s.y):ctx.moveTo(s.x,s.y));ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle='#ffffff';ctx.globalAlpha=.45;ctx.lineWidth=1.8;ctx.beginPath();points.forEach((s,i)=>i?ctx.lineTo(s.x,s.y):ctx.moveTo(s.x,s.y));ctx.stroke();}
    ctx.restore();drawGlowOrb(worldToScreen(current.x,current.y,view),color,size);
  }
  function drawClusterChildren(q,view,now){
    const color=COLORS.cluster;
    for(let index=0;index<(q.clusterImpacts??[]).length;index+=1){
      const child=q.clusterImpacts[index],serverStart=child.visualStartAt??(q.impactAt+1000);
      if(now<serverStart)continue;
      const key=`${q.id}:cluster:${index}`,seen=firstSeen(key,now),visualMs=2000,raw=clamp((now-seen)/visualMs,0,1);
      if(raw>=1)continue;
      const x=lerp(q.impactX,child.x,raw),y=lerp(q.impactY,child.y,raw)-Math.sin(Math.PI*raw)*190,p=worldToScreen(x,y,view),tailRaw=Math.max(0,raw-.18),tx=lerp(q.impactX,child.x,tailRaw),ty=lerp(q.impactY,child.y,tailRaw)-Math.sin(Math.PI*tailRaw)*190,t=worldToScreen(tx,ty,view);
      ctx.save();ctx.globalCompositeOperation='lighter';ctx.strokeStyle=color;ctx.shadowColor=color;ctx.shadowBlur=18;ctx.lineWidth=5;ctx.globalAlpha=.85;ctx.beginPath();ctx.moveTo(t.x,t.y);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.restore();drawGlowOrb(p,color,9);
    }
  }
  function drawAirStrike(q,view,now){
    for(let index=0;index<(q.airStrikeShells??[]).length;index+=1){
      const shell=q.airStrikeShells[index],startAt=shell.visualStartAt??(shell.impactAt-6000);
      if(now<startAt)continue;
      const key=`${q.id}:air:${index}`,seen=firstSeen(key,now),visualMs=5000,raw=clamp((now-seen)/visualMs,0,1);
      if(raw>=1)continue;
      const impact=worldToScreen(shell.x,shell.y,view),eased=raw*raw*(3-2*raw),head={x:impact.x,y:lerp(-18,impact.y,eased)},tailProgress=Math.max(0,raw-.12),tailEase=tailProgress*tailProgress*(3-2*tailProgress),tail={x:impact.x,y:lerp(-18,impact.y,tailEase)};
      ctx.save();ctx.globalCompositeOperation='lighter';ctx.strokeStyle=COLORS.airstrike;ctx.shadowColor=COLORS.airstrike;ctx.shadowBlur=28;ctx.lineWidth=8;ctx.globalAlpha=.9;ctx.beginPath();ctx.moveTo(tail.x,tail.y);ctx.lineTo(head.x,head.y);ctx.stroke();ctx.strokeStyle='#fff';ctx.lineWidth=2.5;ctx.globalAlpha=.78;ctx.beginPath();ctx.moveTo(tail.x,tail.y);ctx.lineTo(head.x,head.y);ctx.stroke();ctx.restore();drawGlowOrb(head,COLORS.airstrike,11);
    }
  }
  function drawProjectilePresentation(activeRoom,view){
    const q=activeRoom?.match?.projectile;if(activeRoom?.status!=='started'||!q)return;
    const now=Date.now(),type=q.weaponType??'basic';
    if(q.id!==lastProjectileId){lastProjectileId=q.id;firstSeen(q.id,now);cleanupStarts(q.id);}
    if(type==='airstrike'){drawAirStrike(q,view,now);return;}
    if(type==='triple'&&q.volley?.length){for(let i=0;i<q.volley.length;i+=1)drawFullBallistic(q.volley[i],view,now,COLORS.triple,10,`${q.id}:triple:${i}`,VISUAL_MS.triple);return;}
    drawFullBallistic(q,view,now,COLORS[type]??COLORS.basic,type==='heavy'?15:type==='cluster'?14:type==='nuke'?13:12,q.id,VISUAL_MS[type]??VISUAL_MS.basic);
    if(type==='cluster')drawClusterChildren(q,view,now);
  }
  function loop(){ctx.clearRect(0,0,overlay.width,overlay.height);if(room?.arena){const view=base.getViewSnapshot?.();if(view)drawProjectilePresentation(room,view);}frameId=requestAnimationFrame(loop);}
  frameId=requestAnimationFrame(loop);
  return Object.freeze({drawScaffold(){room=null;lastProjectileId=null;visualStarts.clear();ctx.clearRect(0,0,overlay.width,overlay.height);base.drawScaffold();},drawArena(nextRoom,nextLocalPlayerId=null){room=nextRoom;base.drawArena(nextRoom,nextLocalPlayerId);},getViewSnapshot(){return base.getViewSnapshot?.()??null;},destroy(){if(frameId)cancelAnimationFrame(frameId);frameId=null;visualStarts.clear();overlay.remove();base.destroy?.();}});
}
