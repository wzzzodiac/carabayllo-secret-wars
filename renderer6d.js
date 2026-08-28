import { createRenderer as createBaseRenderer } from './renderer.js?v=phase6d-camera-api-1';

export function createRenderer(canvas, config) {
  const base = createBaseRenderer(canvas, config);
  const overlayCanvas = document.createElement('canvas');
  overlayCanvas.width = canvas.width;
  overlayCanvas.height = canvas.height;
  overlayCanvas.setAttribute('aria-hidden', 'true');
  Object.assign(overlayCanvas.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '2'
  });
  canvas.parentElement?.appendChild(overlayCanvas);
  const ctx = overlayCanvas.getContext('2d');
  let room = null;
  let localPlayerId = null;
  let frameId = null;

  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const lerp = (a,b,t) => a+(b-a)*t;
  function worldToScreen(x,y,view){return{x:(x-view.x)/view.width*overlayCanvas.width,y:(y-view.y)/view.height*overlayCanvas.height};}

  function fallbackView(activeRoom) {
    const arena=activeRoom?.arena;
    return {x:0,y:0,width:arena?.worldWidth??5000,height:arena?.worldHeight??5000};
  }
  function exactView(activeRoom){return base.getViewSnapshot?.()??fallbackView(activeRoom);}

  function drawNukePickupOverlay(activeRoom, view) {
    if (activeRoom?.match?.projectile?.weaponType === 'nuke') return;
    for (const box of activeRoom?.pickups ?? []) {
      if (box.type !== 'nuke') continue;
      const p = worldToScreen(box.x, box.y-8, view);
      ctx.save();
      ctx.translate(p.x,p.y);
      const pulse=.84+.16*((Math.sin(Date.now()/120)+1)/2);
      ctx.scale(pulse,pulse);
      ctx.rotate(Math.PI/4);
      ctx.shadowBlur=22;
      ctx.shadowColor='#f3b0ff';
      ctx.fillStyle='rgba(216,112,255,.22)';
      ctx.strokeStyle='#f8c8ff';
      ctx.lineWidth=3;
      ctx.strokeRect(-18,-18,36,36);
      ctx.rotate(-Math.PI/4);
      ctx.shadowBlur=0;
      ctx.fillStyle='#fff';
      ctx.font='900 11px ui-monospace,monospace';
      ctx.textAlign='center';
      ctx.fillText('ULT',0,-24);
      ctx.restore();
    }
  }

  function drawSelectedNuke(activeRoom, view) {
    if (activeRoom?.status !== 'started' || activeRoom.match?.projectile) return;
    const id = activeRoom.match?.activePlayerId;
    const player = activeRoom.players?.find(p=>p.id===id);
    if (!player?.spawn || player.alive===false) return;
    const slot=player.selectedItemSlot??1;
    const item=slot>1?player.inventory?.[slot-2]:null;
    if (item?.type!=='nuke') return;
    const p=worldToScreen(player.spawn.x,player.spawn.y-66,view);
    ctx.save();
    ctx.textAlign='center';
    ctx.fillStyle='#f3b0ff';
    ctx.shadowBlur=12;
    ctx.shadowColor='#d86cff';
    ctx.font='900 13px ui-monospace,monospace';
    ctx.fillText(id===localPlayerId?'F // FIRE NUKE DESIGNATOR':'NUKE DESIGNATOR // SPECTATING AIM',p.x,p.y);
    ctx.restore();
  }

  function drawWarning(a,b,center,q,now) {
    const total=Math.max(1,(q.beamAt??now)-(q.targetLockedAt??now));
    const progress=clamp((now-(q.targetLockedAt??now))/total,0,1);
    const pulse=.48+.5*((Math.sin(now/(120-progress*55))+1)/2);
    ctx.fillStyle=`rgba(7,0,15,${.12+.34*progress})`;
    ctx.fillRect(0,0,overlayCanvas.width,overlayCanvas.height);
    ctx.save();
    ctx.globalAlpha=.45+.45*progress;
    ctx.strokeStyle='#f3b0ff';
    ctx.shadowColor='#d86cff';
    ctx.shadowBlur=10+22*progress;
    ctx.lineWidth=2+3*progress;
    ctx.setLineDash([18,10]);
    ctx.lineDashOffset=-(now/22)%28;
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    ctx.setLineDash([]);
    const radius=34+progress*92+pulse*12;
    ctx.beginPath();ctx.arc(center.x,center.y,radius,0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.arc(center.x,center.y,radius*.56,0,Math.PI*2);ctx.stroke();
    ctx.globalAlpha=1;
    ctx.fillStyle='#f8c8ff';
    ctx.textAlign='center';
    ctx.font=`900 ${14+Math.round(progress*5)}px ui-monospace,monospace`;
    ctx.fillText(`NUKE LASER CHARGING // ${Math.max(0,((q.beamAt??now)-now)/1000).toFixed(1)}s`,center.x,center.y-58-radius*.18);
    ctx.font='800 11px ui-monospace,monospace';
    ctx.fillStyle=`rgba(255,255,255,${.55+.4*pulse})`;
    ctx.fillText('WORLD-ENDER TARGET LOCKED',center.x,center.y-38-radius*.18);
    ctx.restore();
  }

  function drawActiveBeam(a,b,center,q,now) {
    const duration=Math.max(1,(q.beamUntil??now)-(q.beamAt??now));
    const t=clamp((now-(q.beamAt??now))/duration,0,1);
    const eruption=clamp(t/.12,0,1);
    const tail=clamp(((q.beamUntil??now)-now)/420,0,1);
    const pulse=.72+.28*Math.sin(now/42);
    ctx.fillStyle=`rgba(50,0,72,${.16+.12*pulse})`;
    ctx.fillRect(0,0,overlayCanvas.width,overlayCanvas.height);
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    const jitterX=Math.sin(now/31)*3.5,jitterY=Math.cos(now/27)*3.5;
    const ax=a.x+jitterX,ay=a.y+jitterY,bx=b.x-jitterX,by=b.y-jitterY;
    ctx.shadowColor='#db63ff';
    ctx.shadowBlur=45;
    ctx.strokeStyle=`rgba(205,79,255,${.30+.28*pulse})`;
    ctx.lineWidth=110*eruption;
    ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx,by);ctx.stroke();
    ctx.shadowBlur=26;
    ctx.strokeStyle=`rgba(243,176,255,${.64+.24*pulse})`;
    ctx.lineWidth=56*eruption;
    ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx,by);ctx.stroke();
    ctx.shadowBlur=18;
    ctx.strokeStyle='#ffffff';
    ctx.lineWidth=(10+6*pulse)*eruption;
    ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx,by);ctx.stroke();

    for(let i=0;i<28;i+=1){
      const p=(i/27+((now/2600)%1))%1;
      const x=lerp(ax,bx,p),y=lerp(ay,by,p);
      const offset=Math.sin(i*9.7+now/85)*(18+22*((i%5)/4));
      const dx=bx-ax,dy=by-ay,len=Math.max(1,Math.hypot(dx,dy));
      const px=-dy/len,py=dx/len;
      const r=2+(i%4)*1.4;
      ctx.fillStyle=i%3===0?'#ffffff':'#efa1ff';
      ctx.globalAlpha=.42+.48*((Math.sin(now/55+i)+1)/2);
      ctx.beginPath();ctx.arc(x+px*offset,y+py*offset,r,0,Math.PI*2);ctx.fill();
    }

    ctx.globalAlpha=.42+.4*tail;
    ctx.strokeStyle='#ffffff';
    ctx.lineWidth=3;
    const ring=45+((now-(q.beamAt??now))/9)%180;
    ctx.beginPath();ctx.arc(center.x,center.y,ring,0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.arc(center.x,center.y,ring*.62,0,Math.PI*2);ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.fillStyle='#fff';
    ctx.textAlign='center';
    ctx.shadowBlur=16;
    ctx.shadowColor='#d86cff';
    ctx.font='900 18px ui-monospace,monospace';
    ctx.fillText('NUKE LASER // TERRAIN DISINTEGRATION',center.x,Math.max(42,center.y-104));
    ctx.restore();
  }

  function drawAfterglow(a,b,center,q,now) {
    const end=q.resolveAt??q.beamUntil??now;
    const span=Math.max(1,end-(q.beamUntil??now));
    const fade=clamp((end-now)/span,0,1);
    if(fade<=0)return;
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    ctx.strokeStyle=`rgba(225,120,255,${.24*fade})`;
    ctx.shadowBlur=30;
    ctx.shadowColor='#d86cff';
    ctx.lineWidth=38*fade;
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    ctx.strokeStyle=`rgba(255,255,255,${.18*fade})`;
    ctx.lineWidth=5;
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    ctx.restore();
    ctx.fillStyle=`rgba(235,125,255,${.055*fade})`;
    ctx.fillRect(0,0,overlayCanvas.width,overlayCanvas.height);
    ctx.fillStyle=`rgba(248,200,255,${.65*fade})`;
    ctx.textAlign='center';
    ctx.font='800 12px ui-monospace,monospace';
    ctx.fillText('NUKE AFTERGLOW // TERRAIN COLLAPSE',center.x,Math.max(34,center.y-82));
  }

  function drawNukeBeam(activeRoom, view, now) {
    const q=activeRoom?.match?.projectile;
    if (!q || q.weaponType!=='nuke' || !q.nukeBeam) return;
    if (now < (q.targetLockedAt ?? q.impactAt ?? 0)) return;
    const a=worldToScreen(q.nukeBeam.ax,q.nukeBeam.ay,view);
    const b=worldToScreen(q.nukeBeam.bx,q.nukeBeam.by,view);
    const center=worldToScreen(q.targetX??q.impactX,q.targetY??q.impactY,view);
    if(now<(q.beamAt??q.warningUntil??0))drawWarning(a,b,center,q,now);
    else if(now<=(q.beamUntil??0))drawActiveBeam(a,b,center,q,now);
    else drawAfterglow(a,b,center,q,now);
  }

  function drawPhase6eCountdown(activeRoom){
    if(activeRoom?.status!=='countdown'||activeRoom?.phase!=='6E')return;
    const x=overlayCanvas.width/2,y=overlayCanvas.height/2+82;
    ctx.save();
    ctx.fillStyle='rgba(2,4,10,.94)';
    ctx.fillRect(x-410,y-18,820,28);
    ctx.textAlign='center';
    ctx.fillStyle='#8995b8';
    ctx.font='12px ui-monospace,monospace';
    ctx.fillText('PHASE 6E // 100-POINT BALANCED PICKUP POOL // FULL ARSENAL',x,y+2);
    ctx.restore();
  }

  function overlayLoop() {
    ctx.clearRect(0,0,overlayCanvas.width,overlayCanvas.height);
    if (room?.arena && ['lobby','countdown','started','finished'].includes(room.status)) {
      const view=exactView(room);
      drawNukePickupOverlay(room,view);
      drawSelectedNuke(room,view);
      drawNukeBeam(room,view,Date.now());
      drawPhase6eCountdown(room);
    }
    frameId=requestAnimationFrame(overlayLoop);
  }
  frameId=requestAnimationFrame(overlayLoop);

  return Object.freeze({
    drawScaffold(){room=null;ctx.clearRect(0,0,overlayCanvas.width,overlayCanvas.height);base.drawScaffold();},
    drawArena(nextRoom,nextLocalPlayerId=null){room=nextRoom;localPlayerId=nextLocalPlayerId;base.drawArena(nextRoom,nextLocalPlayerId);},
    destroy(){if(frameId)cancelAnimationFrame(frameId);frameId=null;overlayCanvas.remove();}
  });
}
