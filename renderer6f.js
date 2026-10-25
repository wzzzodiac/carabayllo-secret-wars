import { createRenderer as createPhase6dRenderer } from './renderer6d.js?v=feel11-20261024&look=pickup-spin-20261025';
import {vehiclePose,VEHICLE_BODY} from './simulation/vehicle-pose.js';
import {drawMiniAvatar,loadMiniAssets,avatarLayout,projectAvatarBounds} from './mini-avatar.js?v=somber-v1-20261025';
import {isBitmapPhysicsRoom as isHuancavelicaV2Room,bitmapIsSolid as huancavelicaV2IsSolid} from './bitmap-map.js?v=somber-v1-20261025';
import {createAvatarWorld,drawAvatarGrounding,drawAvatarContactForeground,drawAvatarDust} from './avatar-world.js?v=peru-canon3-20261024';
import {drawShieldVisual,drawHealVisual,drawWeaponSprite} from './weapon-art.js?v=pickup-spin-20261025';

export function createRenderer(canvas, config) {
  loadMiniAssets().catch(error=>console.error('[Mini squad]',error.message));
  const baseCtx=canvas.getContext('2d');
  const originalFillText=baseCtx.fillText.bind(baseCtx);
  const originalFillRect=baseCtx.fillRect.bind(baseCtx);
  const originalStrokeRect=baseCtx.strokeRect.bind(baseCtx);
  let legacyPlayerNames=new Set();
  baseCtx.fillText=(text,...args)=>{const value=String(text??'');const legacyStatus=value.includes('// HP ')&&(value.startsWith('SURVIVAL')||value.startsWith('TEAM ')||value.startsWith('OUT'));if(legacyStatus||legacyPlayerNames.has(value))return;originalFillText(text,...args);};
  const legacyHealthBar=(w,h)=>Number(h)===7&&Number(w)>=40&&Number(w)<=90;
  baseCtx.fillRect=(x,y,w,h)=>{if(legacyHealthBar(w,h))return;originalFillRect(x,y,w,h);};
  baseCtx.strokeRect=(x,y,w,h)=>{if(legacyHealthBar(w,h))return;originalStrokeRect(x,y,w,h);};
  const base=createPhase6dRenderer(canvas,config);
  const overlay=document.createElement('canvas');
  overlay.width=canvas.width;overlay.height=canvas.height;overlay.setAttribute('aria-hidden','true');
  Object.assign(overlay.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none',zIndex:'3'});
  canvas.parentElement?.appendChild(overlay);
  const ctx=overlay.getContext('2d');
  let room=null,localPlayerId=null,frameId=null;
  const avatarWorld=createAvatarWorld({isSolid:(room,x,y)=>isHuancavelicaV2Room(room)&&huancavelicaV2IsSolid(room,x,y)});
  const VEHICLE_SCALE=.65;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const lerp=(a,b,t)=>a+(b-a)*t;
  const smoothstep=t=>t*t*(3-2*t);
  const weaponLabel=type=>({basic:'BASIC',heavy:'HEAVY BOMB',triple:'TRIPLE SHOT',cluster:'CLUSTER BOMB',shield:'SHIELD',heal:'HEAL +20',airstrike:'AIR STRIKE',nuke:'NUKE LASER'}[type]??String(type??'BASIC').toUpperCase());
  const weaponColor=type=>({basic:'#ffe89a',heavy:'#ffb35c',triple:'#b5f2ff',cluster:'#ffb5d8',shield:'#a6ff87',heal:'#9be7b0',airstrike:'#ffcf7d',nuke:'#f3b0ff'}[type]??'#e7edff');
  function selectedType(activeRoom){const id=activeRoom?.match?.activePlayerId;const player=activeRoom?.players?.find(p=>p.id===id);const slot=player?.selectedItemSlot??1;return slot>1?(player?.inventory?.[slot-2]?.type??'basic'):'basic';}
  function visualPlayerPosition(player,now=Date.now()){
    if(player?.presentation)return vehiclePose(player,now);
    const m=player?.motion;if(!player?.spawn||!m||now>=m.endsAt)return player?.spawn??null;
    const span=Math.max(1,m.endsAt-m.startedAt),raw=clamp((now-m.startedAt)/span,0,1);
    if(m.type==='voidJump'){const lift=.28;if(raw<lift){const t=raw/lift;return{...player.spawn,x:lerp(m.fromX,m.toX,smoothstep(t)),y:lerp(m.fromY,m.fromY-30,t)-Math.sin(Math.PI*t)*(m.apex||150)};}const t=(raw-lift)/(1-lift);return{...player.spawn,x:m.toX,y:lerp(m.fromY-30,m.toY,t*t)};}
    if(m.type==='knockback'||m.type==='knockbackVoid'){const secs=Math.max(.001,span/1000),t=raw*secs,x=lerp(m.fromX,m.toX,raw),ballistic=m.fromY+(m.vy??0)*t+.5*(m.gravity??520)*t*t,y=raw>.965?lerp(ballistic,m.toY,(raw-.965)/.035):ballistic;return{...player.spawn,x,y};}
    const x=lerp(m.fromX,m.toX,raw),baseY=lerp(m.fromY,m.toY,raw),arc=m.type==='jump'?Math.sin(Math.PI*raw)*(m.apex||0):0;return{...player.spawn,x,y:baseY-arc};
  }
  function worldToScreen(x,y,view){return{x:(x-view.x)/view.width*overlay.width,y:(y-view.y)/view.height*overlay.height};}
  function roundedPanel(x,y,w,h,stroke='rgba(140,180,255,.36)'){ctx.fillStyle='rgba(3,7,15,.82)';ctx.strokeStyle=stroke;ctx.lineWidth=1.8;ctx.beginPath();ctx.roundRect(x,y,w,h,11);ctx.fill();ctx.stroke();}
  function drawLiveSpectator(activeRoom){
    if(activeRoom?.status!=='started'||activeRoom.match?.projectile)return;
    const id=activeRoom.match?.activePlayerId;if(!id||id===localPlayerId)return;
    const player=activeRoom.players?.find(p=>p.id===id);if(!player)return;
    const type=activeRoom.spectatorAim?.selectedItemType??selectedType(activeRoom),angle=Math.round(activeRoom.spectatorAim?.angle??activeRoom.match?.aimAngle??45),power=Math.round(activeRoom.spectatorAim?.power??activeRoom.match?.aimPower??55),wind=activeRoom.match?.wind,arrow=wind?.direction==='left'?'←':wind?.direction==='right'?'→':'·',vote=activeRoom.match?.afkSkipVote,now=Date.now(),eligibleAt=Number(vote?.eligibleAt??Infinity),eligibleIn=Math.max(0,eligibleAt-now),voteWindow=Boolean(vote&&now>=eligibleAt),votes=vote?.votes?.length??0,required=vote?.requiredVotes??0,myVote=Boolean(vote?.votes?.includes(localPlayerId)),x=24,y=24,w=640,h=160,color=weaponColor(type),pulse=.65+.35*((Math.sin(now/170)+1)/2);
    ctx.save();roundedPanel(x,y,w,h,voteWindow?`rgba(255,207,125,${.44+.22*pulse})`:`rgba(140,180,255,${.28+.18*pulse})`);ctx.fillStyle='#8cb4ff';ctx.font='900 13px ui-monospace,monospace';ctx.fillText('LIVE SPECTATOR FEED',x+20,y+26);ctx.fillStyle=color;ctx.font='900 22px ui-monospace,monospace';ctx.fillText(`${player.name} // ${weaponLabel(type)}`,x+20,y+58);ctx.fillStyle='#e7edff';ctx.font='800 14px ui-monospace,monospace';ctx.fillText(`AIM ${angle}°   POWER ${power}%   WIND ${arrow} ${wind?.strength??0}`,x+20,y+84);
    if(voteWindow){ctx.fillStyle='#ffcf7d';ctx.font='900 17px ui-monospace,monospace';ctx.fillText(`${player.name} AFK? // PRESS F1 TO SKIP TURN`,x+20,y+119);ctx.fillStyle='#ffffff';ctx.font='900 16px ui-monospace,monospace';ctx.fillText(`VOTES TO SKIP: ${votes}/${required}`,x+20,y+145);ctx.textAlign='right';ctx.fillStyle=myVote?'#a6ff87':'#b8c4dd';ctx.font='800 13px ui-monospace,monospace';ctx.fillText(myVote?'VOTED // F1 TO WITHDRAW':'F1 TO VOTE',x+w-20,y+145);ctx.textAlign='left';}else{ctx.fillStyle='#8fa0bf';ctx.font='800 13px ui-monospace,monospace';ctx.fillText(`AFK SKIP AFTER 20s INACTIVITY // ${Number.isFinite(eligibleAt)?Math.ceil(eligibleIn/1000):20}s`,x+20,y+125);}ctx.fillStyle=voteWindow?'#ffcf7d':color;ctx.globalAlpha=pulse;ctx.beginPath();ctx.arc(x+w-21,y+21,5,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  function drawEnhancedVehicles(activeRoom,view){
    if(!activeRoom?.players?.length)return;
    const now=Date.now();avatarWorld.prune(activeRoom.players.map(player=>player.id));
    const pxX=overlay.width/view.width,pxY=overlay.height/view.height;
    for(const player of activeRoom.players){
      const pos=visualPlayerPosition(player);if(!pos)continue;const s=worldToScreen(pos.x,pos.y,view),visual=avatarLayout(player.appearance),bounds=projectAvatarBounds(visual,{x:s.x,y:s.y,pxX,pxY,facing:pos.facing});if(bounds.right<0||bounds.left>overlay.width||bounds.bottom<0||bounds.top>overlay.height)continue;
      const active=activeRoom.match?.activePlayerId===player.id,local=player.id===localPlayerId;
      const frame=avatarWorld.update(player,pos,activeRoom,now),motion={...frame.motion,pitch:Math.atan(Math.tan(frame.motion.pitch??0)*pxY/Math.max(pxX,pxY))};
      drawAvatarGrounding(ctx,frame,(x,y)=>worldToScreen(x,y,view),pxX,pxY);
      const v2=isHuancavelicaV2Room(activeRoom),w=v2?VEHICLE_BODY.visualWidth*pxX:clamp(168*VEHICLE_SCALE*pxX,31,203),h=v2?VEHICLE_BODY.visualHeight*pxY:clamp(90*VEHICLE_SCALE*pxY,20,117),wr=clamp(h*.28,5,25),cl=clamp(w*.48,20,86),ct=clamp(h*.16,5,18),angle=active?(activeRoom.match?.aimAngle??45):15;
      drawShieldVisual(ctx,player,activeRoom,bounds,now);
      ctx.save();ctx.globalAlpha=player.alive===false?.48:1;const painted=drawMiniAvatar(ctx,player.appearance,{x:s.x,y:s.y,pxX,pxY,facing:pos.facing,motion});ctx.restore();if(painted)drawAvatarContactForeground(ctx,frame,(x,y)=>worldToScreen(x,y,view),canvas,pxX,pxY);if(!painted){ctx.save();ctx.translate(s.x,s.y+(v2?VEHICLE_BODY.feet*pxY-h*.52:0));ctx.scale(pos.facing||1,1);ctx.globalAlpha=player.alive===false?.48:1;ctx.fillStyle=activeRoom.mode==='survival'?'#d6b4ff':player.team==='A'?'#8cb4ff':'#ff9aa8';ctx.strokeStyle=active?'#ffe89a':local?'#fff':'rgba(231,237,255,.72)';ctx.lineWidth=active?4:local?3.6:2.6;ctx.beginPath();ctx.roundRect(-w/2,-h*.62,w,h,Math.max(5,h*.25));ctx.fill();ctx.stroke();ctx.fillStyle='#08101d';ctx.beginPath();ctx.arc(-w*.27,h*.24,wr,0,Math.PI*2);ctx.arc(w*.27,h*.24,wr,0,Math.PI*2);ctx.fill();ctx.save();ctx.translate(w*.08,-h*.72);ctx.rotate(-angle*Math.PI/180);ctx.fillRect(0,-ct/2,cl,ct);ctx.restore();ctx.restore();}
      drawHealVisual(ctx,player,bounds,now);
      const hp=clamp(player.hp??100,0,player.maxHp??100),maxHp=player.maxHp??100,label=local?`YOU // HP ${hp}`:`${player.name} // HP ${hp}`,barW=clamp(w*1.45,98,234),barH=clamp(h*.16,9,16),labelY=Math.min(s.y-72,bounds.top-36);
      ctx.save();ctx.font='900 16px ui-monospace,monospace';const boxW=Math.max(137,Math.min(247,ctx.measureText(label).width+33));ctx.fillStyle='rgba(3,7,15,.96)';ctx.beginPath();ctx.roundRect(s.x-boxW/2,labelY-23,boxW,49,7);ctx.fill();ctx.textAlign='center';ctx.fillStyle=local?'#ffffff':active?'#ffe89a':'#e7edff';ctx.fillText(label,s.x,labelY-6);ctx.fillStyle='rgba(4,8,16,.95)';ctx.fillRect(s.x-barW/2,labelY+7,barW,barH);ctx.fillStyle=hp>50?'#9be7b0':hp>25?'#ffe89a':'#ff9aa8';ctx.fillRect(s.x-barW/2,labelY+7,barW*(hp/maxHp),barH);ctx.strokeStyle='rgba(231,237,255,.72)';ctx.lineWidth=1.6;ctx.strokeRect(s.x-barW/2,labelY+7,barW,barH);ctx.restore();
    }
    drawAvatarDust(ctx,avatarWorld.particles,now,(x,y)=>worldToScreen(x,y,view),pxX,pxY);
  }
  function drawWeaponBadge(activeRoom,view){
    if(activeRoom?.status!=='started'||activeRoom.match?.projectile)return;
    const id=activeRoom.match?.activePlayerId,player=activeRoom.players?.find(p=>p.id===id);if(!player?.spawn)return;
    const pos=visualPlayerPosition(player);if(!pos)return;const type=selectedType(activeRoom);if(type==='basic')return;
    const p=worldToScreen(pos.x,pos.y,view),bounds=projectAvatarBounds(avatarLayout(player.appearance),{x:p.x,y:p.y,pxX:overlay.width/view.width,pxY:overlay.height/view.height,facing:pos.facing});
    p.y=Math.min(p.y-72,bounds.top-36)-56;if(p.x<-220||p.x>overlay.width+220||p.y<-140||p.y>overlay.height+140)return;
    const label=weaponLabel(type),color=weaponColor(type),width=clamp(label.length*8+68,100,210),x=p.x-width/2;
    ctx.save();roundedPanel(x,p.y-23,width,42,color+'88');drawWeaponSprite(ctx,type,x+23,p.y-2,{size:32,icon:true});ctx.textAlign='left';ctx.fillStyle=color;ctx.font='900 13px ui-monospace,monospace';ctx.fillText(label,x+45,p.y+2);ctx.restore();
  }
  function resolutionText(q,now){const type=q?.weaponType??'basic';if(type==='nuke'){if(now<(q.targetLockedAt??q.impactAt??0))return['NUKE DESIGNATOR','IN FLIGHT'];if(now<(q.beamAt??0))return['NUKE LASER',`CHARGING ${Math.max(0,((q.beamAt-now)/1000)).toFixed(1)}s`];if(now<=(q.beamUntil??0))return['NUKE LASER','WORLD-ENDER FIRING'];return['NUKE LASER','TERRAIN COLLAPSE'];}if(type==='airstrike')return['AIR STRIKE',now<(q.warningUntil??0)?`INBOUND ${Math.max(0,((q.warningUntil-now)/1000)).toFixed(1)}s`:'SHELL IMPACTS'];if(type==='triple')return['TRIPLE SHOT','VOLLEY IN FLIGHT'];if(type==='cluster')return['CLUSTER BOMB','DISPERSAL IN PROGRESS'];if(type==='heavy')return['HEAVY BOMB','PROJECTILE IN FLIGHT'];return['BASIC SHOT','PROJECTILE IN FLIGHT'];}
  function drawResolutionRibbon(activeRoom){const q=activeRoom?.match?.projectile;if(activeRoom?.status!=='started'||!q)return;const now=Date.now(),[title,state]=resolutionText(q,now),type=q.weaponType??'basic',color=weaponColor(type),w=540,h=68,x=(overlay.width-w)/2,y=20;ctx.save();roundedPanel(x,y,w,h,`${color}99`);ctx.textAlign='center';ctx.fillStyle=color;ctx.font='900 18px ui-monospace,monospace';ctx.fillText(title,overlay.width/2,y+28);ctx.fillStyle='#e7edff';ctx.font='800 14px ui-monospace,monospace';ctx.fillText(state,overlay.width/2,y+52);ctx.restore();}
  function drawCountdown(activeRoom){
    if(activeRoom?.status!=='countdown')return;
    const x=overlay.width/2,y=overlay.height/2,terrain=activeRoom.arena?.terrainName??activeRoom.terrainPreset??'MAP',mode=activeRoom.mode==='team'?'TEAM MODE':'SURVIVAL MODE';
    ctx.save();ctx.fillStyle='rgba(2,4,10,.97)';ctx.fillRect(x-430,y-125,860,250);ctx.strokeStyle='rgba(140,180,255,.34)';ctx.lineWidth=2;ctx.strokeRect(x-430,y-125,860,250);ctx.textAlign='center';ctx.fillStyle='#ffffff';ctx.font='900 76px system-ui,sans-serif';ctx.fillText('START',x,y-22);ctx.fillStyle='#8cb4ff';ctx.font='900 22px ui-monospace,monospace';ctx.fillText(String(terrain).toUpperCase(),x,y+36);ctx.fillStyle='#b8c4dd';ctx.font='800 17px ui-monospace,monospace';ctx.fillText(mode,x,y+76);ctx.restore();
  }
  function loop(){ctx.clearRect(0,0,overlay.width,overlay.height);if(room?.arena){const view=base.getViewSnapshot?.();if(view){drawEnhancedVehicles(room,view);drawWeaponBadge(room,view);}drawLiveSpectator(room);drawResolutionRibbon(room);drawCountdown(room);}frameId=requestAnimationFrame(loop);}
  frameId=requestAnimationFrame(loop);
  return Object.freeze({drawScaffold(){avatarWorld.clear();room=null;legacyPlayerNames=new Set();ctx.clearRect(0,0,overlay.width,overlay.height);base.drawScaffold();},drawArena(nextRoom,nextLocalPlayerId=null){room=nextRoom;localPlayerId=nextLocalPlayerId;legacyPlayerNames=new Set((nextRoom?.players??[]).map(player=>String(player.name??'')));base.drawArena(nextRoom,nextLocalPlayerId);},getViewSnapshot(){return base.getViewSnapshot?.()??null;},destroy(){avatarWorld.dispose();if(frameId)cancelAnimationFrame(frameId);frameId=null;overlay.remove();baseCtx.fillText=originalFillText;baseCtx.fillRect=originalFillRect;baseCtx.strokeRect=originalStrokeRect;base.destroy?.();}});
}
