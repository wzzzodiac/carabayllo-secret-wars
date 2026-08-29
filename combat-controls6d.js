import { initCombatControls as initBaseControls } from './combat-controls.js?v=v098-csw-afk-1';

export function initCombatControls(gameCanvas) {
  const base = initBaseControls(gameCanvas);
  const panel = document.getElementById('gameInfoPanel');
  let currentRoom = null;
  let currentPlayerId = null;

  function patchPhase6dHud() {
    const room = currentRoom;
    if (!room || !panel) return;
    const q = room.match?.projectile;
    const turnState = panel.querySelector('.turn-state');
    const myTurn = room.status==='started' && room.match?.activePlayerId===currentPlayerId;

    if (q?.weaponType === 'nuke' && turnState) {
      const now = Date.now();
      if (now < (q.targetLockedAt ?? q.impactAt ?? 0)) {
        turnState.textContent = 'NUKE DESIGNATOR IN FLIGHT';
      } else if (now < (q.beamAt ?? 0)) {
        turnState.textContent = `NUKE LASER CHARGING // ${Math.max(0, ((q.beamAt-now)/1000)).toFixed(1)}s`;
      } else if (now <= (q.beamUntil ?? 0)) {
        turnState.textContent = 'NUKE LASER // WORLD-ENDER FIRING';
      } else {
        turnState.textContent = 'NUKE AFTERGLOW // TERRAIN COLLAPSE';
      }
    } else if(turnState && room.status==='started' && !myTurn && !q){
      turnState.textContent='SPECTATING // LIVE AIM VISIBLE';
    }

    for(const cell of panel.querySelectorAll('.info-grid > div')){
      const label=cell.querySelector('span')?.textContent?.trim();
      const value=cell.querySelector('strong');
      if(label==='JUMPS'&&value)value.textContent='FREE';
    }
    for(const line of panel.querySelectorAll('.control-line')){
      const text=line.querySelector('span')?.textContent??'';
      const value=line.querySelector('strong');
      if(!value)continue;
      if(text.includes('move'))value.textContent='FREE MAP';
      if(text.includes('jump'))value.textContent='FREE // ~0.5s';
    }

    const note = panel.querySelector('.pickup-note');
    if (note && !note.dataset.phase6ePatched) {
      note.dataset.phase6ePatched = 'true';
      note.textContent += ' Current movement is free across reachable terrain during the 40-second turn: there is no movement radius and no per-turn jump quota; normal jump cadence is about half a second. All clients receive the active player aim so spectators can watch angle, power and trajectory live. Nuke Laser uses that trajectory as its designator, then warns visually for 5 seconds and fires a sustained 5-second terrain-disintegration beam. Phase 6E uses a 100-point pickup pool: Heavy 25, Triple 20, Cluster 20, Shield 12, Heal 12, Air Strike 8, Nuke 3.';
    }
  }

  const timer = setInterval(patchPhase6dHud, 100);
  return Object.freeze({
    update(room, playerId) {
      currentRoom = room;
      currentPlayerId = playerId;
      base.update(room, playerId);
      patchPhase6dHud();
    },
    destroy() {
      clearInterval(timer);
      currentRoom = null;
      currentPlayerId = null;
      base.destroy();
    }
  });
}
