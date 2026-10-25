import { createRenderer as createPhase6fRenderer } from './renderer6f.js?v=feel11-20261024&look=pickup-spin-20261025';
import {loadWeaponArt,drawWeaponSprite,weaponVisualSize,projectileVisualPose,drawWeaponTrail,drawWeaponImpact,drawTargetBeacon} from './weapon-art.js?v=pickup-spin-20261025';

export function createRenderer(canvas, config) {
  loadWeaponArt().catch(error=>console.error('[Arsenal]',error.message));
  const base=createPhase6fRenderer(canvas,config);
  const overlay=document.createElement('canvas');
  overlay.width=canvas.width;overlay.height=canvas.height;overlay.setAttribute('aria-hidden','true');
  Object.assign(overlay.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none',zIndex:'5'});
  canvas.parentElement?.appendChild(overlay);
  const ctx=overlay.getContext('2d');
  let room=null,frameId=null;
  const visualSfxSeen=new Set();
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const lerp=(a,b,t)=>a+(b-a)*t;
  const COLORS={basic:'#fff0a8',heavy:'#ffad5c',triple:'#b5f2ff',cluster:'#ffb5d8',nuke:'#f3b0ff',airstrike:'#ffd58a'};
  function worldToScreen(x,y,view){return{x:(x-view.x)/view.width*overlay.width,y:(y-view.y)/view.height*overlay.height};}
  function ballisticPosition(p,now=Date.now()){
    if(!p)return null;
    const duration=Math.max(1,p.durationMs??(p.impactAt-p.startedAt)??1),elapsed=clamp(now-p.startedAt,0,duration)/1000;
    return{x:p.startX+(p.vx??0)*elapsed+.5*(p.windAccel??0)*elapsed*elapsed,y:p.startY+(p.vy??0)*elapsed+.5*(p.gravity??0)*elapsed*elapsed};
  }
  function emitVisualSfx(key,name,volume=1){
    if(visualSfxSeen.has(key))return;
    if(visualSfxSeen.size>=256)visualSfxSeen.delete(visualSfxSeen.values().next().value);
    visualSfxSeen.add(key);
    window.dispatchEvent(new CustomEvent('orbital-visual-sfx',{detail:{key,name,volume,emittedAt:Date.now()}}));
  }
  function emitAtOrAfter(key,name,at,now,volume=1){
    const time=Number(at);if(!Number.isFinite(time)||now<time)return;
    emitVisualSfx(key,name,volume);
  }
  function emitProjectileSfx(q,now){
    if(!q)return;
    const root=String(q.id??`${q.ownerPlayerId??'x'}:${q.weaponType??'basic'}:${q.startedAt??0}`),type=q.weaponType??'basic';
    if(type==='basic'){
      emitAtOrAfter(`${root}:launch`,'basic',q.startedAt,now);
      emitAtOrAfter(`${root}:impact`,'basicExplosion',q.impactAt,now);
    }else if(type==='heavy'){
      emitAtOrAfter(`${root}:launch`,'heavy',q.startedAt,now);
      emitAtOrAfter(`${root}:impact`,'loudExplosion',q.impactAt,now,.96);
    }else if(type==='triple'){
      for(const [index,v] of (q.volley??[]).entries()){
        emitAtOrAfter(`${root}:triple-launch:${index}`,'basic',v.startedAt,now);
        emitAtOrAfter(v.impactId??`${root}:triple-impact:${index}`,'basicExplosion',v.impactAt,now,.92);
      }
    }else if(type==='cluster'){
      emitAtOrAfter(`${root}:cluster-main-launch`,'heavy',q.startedAt,now);
      emitAtOrAfter(`${root}:cluster-main-impact`,'loudExplosion',q.impactAt,now,.96);
      for(const [index,child] of (q.clusterImpacts??[]).entries()){
        emitAtOrAfter(`${root}:cluster-child-launch:${index}`,'basic',child.visualStartAt??child.impactAt,now,.9);
        emitAtOrAfter(child.impactId??`${root}:cluster-child-impact:${index}`,'basicExplosion',child.impactAt,now,.88);
      }
    }else if(type==='nuke'){
      emitAtOrAfter(`${root}:launch`,'heavy',q.startedAt,now);
      if(now<(q.beamAt??Infinity))emitAtOrAfter(`${root}:warning`,'warning',q.targetLockedAt??q.impactAt,now,.7);
      if(now<=(q.beamUntil??Infinity))emitAtOrAfter(`${root}:laser`,'nuke',q.beamAt,now);
      emitAtOrAfter(`${root}:laser-end`,'nukeExplosion',q.beamUntil,now);
    }else if(type==='airstrike'){
      emitAtOrAfter(`${root}:air-begin`,'airBegin',q.startedAt,now);
      for(const [index,shell] of (q.airStrikeShells??[]).entries()){
        emitAtOrAfter(`${root}:air-shell-launch:${index}`,'basic',shell.visualStartAt??shell.startedAt??shell.impactAt,now,.68);
        emitAtOrAfter(shell.impactId??`${root}:air-shell-impact:${index}`,'basicExplosion',shell.impactAt,now,.9);
      }
    }
  }
  function drawMuzzleFlash(p,view,now,type){
    const age=now-p.startedAt;if(age<0||age>170||['airbomb','child'].includes(type))return;
    const pose=projectileVisualPose(p,now,view,overlay.width,overlay.height);
    ctx.save();ctx.translate((p.startX-view.x)/view.width*overlay.width,(p.startY-view.y)/view.height*overlay.height);ctx.rotate(pose.angle);ctx.globalAlpha=(1-age/170)*.7;ctx.fillStyle='#e7c894';
    ctx.beginPath();ctx.moveTo(0,-4);ctx.lineTo(24,0);ctx.lineTo(0,4);ctx.closePath();ctx.fill();ctx.restore();
  }
  function drawImpactPulse(x,y,view,age,type,mult=1){
    const p=worldToScreen(x,y,view);drawWeaponImpact(ctx,type,p.x,p.y,age,{scale:overlay.width/view.width,mult});
  }
  function projectileSize(view,ownerId=room?.match?.projectile?.ownerPlayerId){
    const player=room?.players?.find(p=>p.id===ownerId)??room?.players?.find(p=>p.id===room.match?.activePlayerId)??room?.players?.[0];
    return weaponVisualSize(player?.appearance,overlay.width/view.width,overlay.height/view.height,'projectile');
  }
  function drawFullBallistic(p,view,now,type='basic'){
    if(!p||!Number.isFinite(p.startX)||!Number.isFinite(p.startY)||now<p.startedAt||now>=p.impactAt)return;
    const current=projectileVisualPose(p,now,view,overlay.width,overlay.height),duration=Math.max(1,p.impactAt-p.startedAt),progress=clamp((now-p.startedAt)/duration,0,1);
    const samples=Math.max(2,Math.min(110,Math.ceil(progress*100))),points=[];
    for(let i=0;i<=samples;i++){const q=ballisticPosition(p,p.startedAt+duration*progress*i/samples);points.push(worldToScreen(q.x,q.y,view));}
    drawWeaponTrail(ctx,points,type,clamp(overlay.width/view.width,.6,1.3));drawMuzzleFlash(p,view,now,type);
    const width=projectileSize(view,p.ownerPlayerId);
    drawWeaponSprite(ctx,type,current.x,current.y,{size:width,angle:current.angle});
  }
  function drawClusterChildren(q,view,now){
    for(const child of q.clusterImpacts??[]){
      const startAt=child.visualStartAt??(q.impactAt+1000),end=child.impactAt;
      if(now>=end){drawImpactPulse(child.x,child.y,view,now-end,'child',.72);continue;}
      if(now<startAt)continue;
      if(child.bitmapFlight){drawFullBallistic(child,view,now,'child');continue;}
      const raw=clamp((now-startAt)/Math.max(1,end-startAt),0,1),dx=child.x-q.impactX,dy=child.y-q.impactY;
      const p=worldToScreen(lerp(q.impactX,child.x,raw),lerp(q.impactY,child.y,raw)-Math.sin(Math.PI*raw)*190,view);
      drawWeaponSprite(ctx,'child',p.x,p.y,{size:projectileSize(view),angle:Math.atan2((dy-Math.cos(Math.PI*raw)*190*Math.PI)*overlay.height/view.height,dx*overlay.width/view.width)});
    }
  }
  function drawAirStrike(q,view,now){
    drawFullBallistic(q,view,now,'airstrike');
    if(now>=q.impactAt){const p=worldToScreen(q.targetX??q.impactX,q.impactY,view);drawTargetBeacon(ctx,'airstrike',p.x,p.y,projectileSize(view),now);}
    for(const shell of q.airStrikeShells??[]){
      const startAt=shell.visualStartAt??(shell.impactAt-6000),end=shell.impactAt;
      if(now>=end){drawImpactPulse(shell.x,shell.y,view,now-end,'airbomb',.88);continue;}
      if(now<startAt)continue;
      if(shell.bitmapFlight){drawFullBallistic(shell,view,now,'airbomb');continue;}
      const raw=clamp((now-startAt)/Math.max(1,end-startAt),0,1),eased=raw*raw*(3-2*raw),impact=worldToScreen(shell.x,shell.y,view),head={x:impact.x,y:lerp(-18,impact.y,eased)};
      const tailProgress=Math.max(0,raw-.12),tailEase=tailProgress*tailProgress*(3-2*tailProgress),tail={x:impact.x,y:lerp(-18,impact.y,tailEase)};
      drawWeaponTrail(ctx,[tail,head],'airbomb');drawWeaponSprite(ctx,'airbomb',head.x,head.y,{size:projectileSize(view),angle:Math.PI/2});
    }
  }
  function drawProjectilePresentation(activeRoom,view){
    const q=activeRoom?.match?.projectile;if(activeRoom?.status!=='started'||!q)return;
    const now=Date.now(),type=q.weaponType??'basic';emitProjectileSfx(q,now);
    if(type==='airstrike'){drawAirStrike(q,view,now);return;}
    if(type==='triple'&&q.volley?.length){for(const v of q.volley){drawFullBallistic(v,view,now,'triple');drawImpactPulse(v.impactX,v.impactY,view,now-v.impactAt,'triple',.78);}return;}
    drawFullBallistic(q,view,now,type);
    if(type==='nuke'){
      if(now>=(q.targetLockedAt??q.impactAt)){const p=worldToScreen(q.targetX??q.impactX,q.targetY??q.impactY,view);drawTargetBeacon(ctx,'nuke',p.x,p.y,projectileSize(view),now);}
    }else drawImpactPulse(q.impactX,q.impactY,view,now-q.impactAt,type,type==='heavy'?1.45:type==='cluster'?.65:1);
    if(type==='cluster')drawClusterChildren(q,view,now);
  }
  function roomForBase(nextRoom){
    const result={...nextRoom,arsenalPresentation:true},q=nextRoom?.match?.projectile;if(!q)return result;
    if(q.weaponType==='airstrike')return{...result,match:{...nextRoom.match,projectile:{...q,cameraAirStrikeShells:q.airStrikeShells,airStrikeShells:[]}}};
    if(q.weaponType==='cluster')return{...result,match:{...nextRoom.match,projectile:{...q,clusterImpacts:[]}}};
    return result;
  }
  function loop(){ctx.clearRect(0,0,overlay.width,overlay.height);if(room?.arena){const view=base.getViewSnapshot?.();if(view)drawProjectilePresentation(room,view);}frameId=requestAnimationFrame(loop);}
  frameId=requestAnimationFrame(loop);
  return Object.freeze({drawScaffold(){room=null;ctx.clearRect(0,0,overlay.width,overlay.height);base.drawScaffold();},drawArena(nextRoom,nextLocalPlayerId=null){room=nextRoom;base.drawArena(roomForBase(nextRoom),nextLocalPlayerId);},getViewSnapshot(){return base.getViewSnapshot?.()??null;},destroy(){if(frameId)cancelAnimationFrame(frameId);frameId=null;overlay.remove();base.destroy?.();}});
}
