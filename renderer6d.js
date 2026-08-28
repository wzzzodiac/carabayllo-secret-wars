import { createRenderer as createBaseRenderer } from './renderer.js?v=phase6c-airstrike-visual-1';

export function createRenderer(canvas, config) {
  const base = createBaseRenderer(canvas, config);
  const ctx = canvas.getContext('2d');
  let room = null;
  let localPlayerId = null;
  let frameId = null;

  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  function worldToScreen(x,y,view){return{x:(x-view.x)/view.width*canvas.width,y:(y-view.y)/view.height*canvas.height};}

  function approximateView(activeRoom) {
    const q = activeRoom?.match?.projectile;
    const target = q?.weaponType === 'nuke'
      ? { x:q.targetX ?? q.impactX ?? 2500, y:q.targetY ?? q.impactY ?? 2500 }
      : activeRoom?.players?.find(p=>p.id===(activeRoom.camera?.targetPlayerId||activeRoom.match?.activePlayerId||localPlayerId))?.spawn;
    if (!target) return {x:0,y:0,width:activeRoom?.arena?.worldWidth??5000,height:activeRoom?.arena?.worldHeight??5000};
    const width = 1000;
    const height = 1000;
    return {
      x:clamp(target.x-width/2,0,(activeRoom.arena?.worldWidth??5000)-width),
      y:clamp(target.y-height/2,0,(activeRoom.arena?.worldHeight??5000)-height),
      width,
      height
    };
  }

  function drawNukePickupOverlay(activeRoom, view) {
    for (const box of activeRoom?.pickups ?? []) {
      if (box.type !== 'nuke') continue;
      const p = worldToScreen(box.x, box.y-8, view);
      ctx.save();
      ctx.translate(p.x,p.y);
      ctx.rotate(Math.PI/4);
      ctx.fillStyle='rgba(216,112,255,.32)';
      ctx.strokeStyle='#f3b0ff';
      ctx.lineWidth=3;
      ctx.fillRect(-14,-14,28,28);
      ctx.strokeRect(-14,-14,28,28);
      ctx.rotate(-Math.PI/4);
      ctx.fillStyle='#fff';
      ctx.font='900 13px ui-monospace,monospace';
      ctx.textAlign='center';
      ctx.fillText('N',0,5);
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
    const p=worldToScreen(player.spawn.x,player.spawn.y-62,view);
    ctx.save();
    ctx.textAlign='center';
    ctx.fillStyle='#f3b0ff';
    ctx.font='900 13px ui-monospace,monospace';
    ctx.fillText(id===localPlayerId?'F // FIRE NUKE LASER':'NUKE LASER SELECTED',p.x,p.y);
    ctx.restore();
  }

  function drawNukeBeam(activeRoom, view, now) {
    const q=activeRoom?.match?.projectile;
    if (!q || q.weaponType!=='nuke' || !q.nukeBeam) return;
    if (now < (q.targetLockedAt ?? q.impactAt ?? 0)) return;
    const a=worldToScreen(q.nukeBeam.ax,q.nukeBeam.ay,view);
    const b=worldToScreen(q.nukeBeam.bx,q.nukeBeam.by,view);
    const center=worldToScreen(q.targetX??q.impactX,q.targetY??q.impactY,view);
    const warning=now<(q.beamAt??q.warningUntil??0);
    ctx.save();
    if (warning) {
      const pulse=.5+.45*((Math.sin(now/85)+1)/2);
      ctx.globalAlpha=pulse;
      ctx.strokeStyle='#f3b0ff';
      ctx.lineWidth=3;
      ctx.setLineDash([14,10]);
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha=1;
      ctx.fillStyle='#f3b0ff';
      ctx.textAlign='center';
      ctx.font='900 14px ui-monospace,monospace';
      ctx.fillText(`NUKE LASER // ${Math.max(0,((q.beamAt??now)-now)/1000).toFixed(1)}s`,center.x,center.y-48);
    } else if (now <= (q.beamUntil??0)) {
      const fade=clamp(((q.beamUntil??now)-now)/420,0,1);
      ctx.globalCompositeOperation='lighter';
      ctx.strokeStyle=`rgba(243,176,255,${.28+.55*fade})`;
      ctx.lineWidth=34;
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
      ctx.strokeStyle='#ffffff';
      ctx.lineWidth=8;
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
      ctx.fillStyle=`rgba(235,125,255,${.08+.18*fade})`;
      ctx.fillRect(0,0,canvas.width,canvas.height);
    }
    ctx.restore();
  }

  function overlayLoop() {
    if (room?.arena && ['lobby','countdown','started','finished'].includes(room.status)) {
      const view=approximateView(room);
      drawNukePickupOverlay(room,view);
      drawSelectedNuke(room,view);
      drawNukeBeam(room,view,Date.now());
    }
    frameId=requestAnimationFrame(overlayLoop);
  }
  frameId=requestAnimationFrame(overlayLoop);

  return Object.freeze({
    drawScaffold(){room=null;base.drawScaffold();},
    drawArena(nextRoom,nextLocalPlayerId=null){room=nextRoom;localPlayerId=nextLocalPlayerId;base.drawArena(nextRoom,nextLocalPlayerId);},
    destroy(){if(frameId)cancelAnimationFrame(frameId);frameId=null;}
  });
}
