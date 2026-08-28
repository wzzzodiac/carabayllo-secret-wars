import { initCombatControls as initBaseControls } from './combat-controls.js?v=phase6c-airstrike-visual-1';

export function initCombatControls(gameCanvas) {
  const base = initBaseControls(gameCanvas);
  const panel = document.getElementById('gameInfoPanel');
  let currentRoom = null;
  let currentPlayerId = null;

  function patchNukeHud() {
    const room = currentRoom;
    if (!room || !panel) return;
    const q = room.match?.projectile;
    const turnState = panel.querySelector('.turn-state');
    if (q?.weaponType === 'nuke' && turnState) {
      const now = Date.now();
      if (now < (q.targetLockedAt ?? q.impactAt ?? 0)) {
        turnState.textContent = 'NUKE DESIGNATOR IN FLIGHT';
      } else if (now < (q.beamAt ?? 0)) {
        turnState.textContent = `NUKE LASER CHARGING // ${Math.max(0, ((q.beamAt-now)/1000)).toFixed(1)}s`;
      } else if (now <= (q.beamUntil ?? 0)) {
        turnState.textContent = 'NUKE LASER FIRING';
      } else {
        turnState.textContent = 'NUKE LASER RESOLVING';
      }
    }

    const note = panel.querySelector('.pickup-note');
    if (note && !note.dataset.phase6dPatched) {
      note.dataset.phase6dPatched = 'true';
      note.textContent += ' Nuke Laser uses the normal aim trajectory as a designator, then fires a diagonal terrain-disintegration beam. It deals 20 direct damage, has no conventional knockback, destroys pickups in the beam, and always ends the turn.';
    }
  }

  const timer = setInterval(patchNukeHud, 100);
  return Object.freeze({
    update(room, playerId) {
      currentRoom = room;
      currentPlayerId = playerId;
      base.update(room, playerId);
      patchNukeHud();
    },
    destroy() {
      clearInterval(timer);
      currentRoom = null;
      currentPlayerId = null;
      base.destroy();
    }
  });
}
