import { initCombatControls as initPhase6dControls } from './combat-controls6d.js?v=phase6f-hud-base-1';

export function initCombatControls(gameCanvas) {
  const base=initPhase6dControls(gameCanvas);
  const panel=document.getElementById('gameInfoPanel');
  let room=null,playerId=null;
  const weaponLabel=type=>({basic:'BASIC',heavy:'HEAVY BOMB',triple:'TRIPLE SHOT',cluster:'CLUSTER BOMB',shield:'SHIELD',heal:'HEAL +30',airstrike:'AIR STRIKE',nuke:'NUKE LASER'}[type]??String(type??'BASIC').toUpperCase());
  function selectedType(activeRoom){const id=activeRoom?.match?.activePlayerId,p=activeRoom?.players?.find(x=>x.id===id),slot=p?.selectedItemSlot??1;return slot>1?(p?.inventory?.[slot-2]?.type??'basic'):'basic';}
  function patch(){
    if(!room||!panel||!['started','finished'].includes(room.status))return;
    const active=room.players?.find(p=>p.id===room.match?.activePlayerId),q=room.match?.projectile,myTurn=room.status==='started'&&room.match?.activePlayerId===playerId;
    const type=q?.weaponType??room.spectatorAim?.selectedItemType??selectedType(room),label=weaponLabel(type),angle=Math.round(room.spectatorAim?.angle??room.match?.aimAngle??45),power=Math.round(room.spectatorAim?.power??room.match?.aimPower??55);
    const turnState=panel.querySelector('.turn-state');
    if(turnState&&room.status==='started'&&!q){turnState.textContent=myTurn?`YOUR TURN // ${label}`:`SPECTATING ${active?.name??'PLAYER'} // ${label} // ${angle}° // ${power}%`;}
    const grid=panel.querySelector('.info-grid');
    if(grid){
      let weaponCell=[...grid.children].find(cell=>cell.querySelector('span')?.textContent?.trim()==='WEAPON');
      if(!weaponCell){weaponCell=document.createElement('div');weaponCell.innerHTML='<span>WEAPON</span><strong>—</strong>';grid.appendChild(weaponCell);}
      weaponCell.querySelector('strong').textContent=label;
      let syncCell=[...grid.children].find(cell=>cell.querySelector('span')?.textContent?.trim()==='AIM SYNC');
      if(!syncCell){syncCell=document.createElement('div');syncCell.innerHTML='<span>AIM SYNC</span><strong>—</strong>';grid.appendChild(syncCell);}
      syncCell.querySelector('strong').textContent=room.status==='started'?'LIVE':'—';
    }
    const note=panel.querySelector('.pickup-note');
    if(note&&!note.dataset.phase6fPatched){note.dataset.phase6fPatched='true';note.textContent+=' Phase 6F adds spectator telemetry, active-weapon identification and weapon-specific resolution status so waiting players can follow each turn without changing authoritative gameplay.';}
  }
  const timer=setInterval(patch,100);
  return Object.freeze({
    update(nextRoom,nextPlayerId){room=nextRoom;playerId=nextPlayerId;base.update(nextRoom,nextPlayerId);patch();},
    destroy(){clearInterval(timer);room=null;playerId=null;base.destroy();}
  });
}
