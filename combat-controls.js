export function initCombatControls(gameCanvas) {
  if (!(gameCanvas instanceof HTMLCanvasElement)) throw new TypeError('A valid game canvas is required.');
  const panel = document.getElementById('gameInfoPanel');
  if (!(panel instanceof HTMLElement)) throw new Error('Missing #gameInfoPanel.');

  let currentRoom = null, currentPlayerId = null, timer = null;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const key = value => `<kbd>${esc(value)}</kbd>`;

  function weaponButton(slot, name, meta, selected, disabled, special = false) {
    return `<button class="weapon-button${selected?' selected':''}${special?' special':''}" type="button" data-weapon-slot="${slot}" ${disabled?'disabled':''}><span class="weapon-key">${slot}</span><span class="weapon-name">${esc(name)}</span><span class="weapon-meta">${esc(meta)}</span></button>`;
  }

  function render() {
    const room = currentRoom, playerId = currentPlayerId;
    if (!room || !['started','finished'].includes(room.status)) {
      panel.innerHTML = '<div class="game-info-empty"><span class="section-label">BATTLE INFO</span><strong>WAITING FOR MATCH</strong><p>Turn data, controls and weapon selection will appear here.</p></div>';
      return;
    }

    const me = room.players?.find(player => player.id === playerId);
    const active = room.players?.find(player => player.id === room.match?.activePlayerId);
    const myTurn = room.status === 'started' && room.match?.activePlayerId === playerId && me?.alive !== false;
    const projectile = room.match?.projectile;
    const remaining = room.status === 'started' ? Math.max(0, ((room.match?.turnEndsAt ?? Date.now()) - Date.now()) / 1000) : 0;
    const wind = room.match?.wind;
    const arrow = wind?.direction === 'left' ? '←' : wind?.direction === 'right' ? '→' : '·';
    const selected = me?.selectedItemSlot ?? 1;
    const inv1 = me?.inventory?.[0] ?? null;
    const inv2 = me?.inventory?.[1] ?? null;
    const alive = room.players?.filter(player => player.alive !== false).length ?? 0;
    const stateText = room.status === 'finished' ? 'MATCH ENDED' : projectile ? 'SHOT IN FLIGHT' : myTurn ? 'YOUR TURN' : 'SPECTATING';

    panel.innerHTML = `
      <section class="info-block">
        <div class="info-block-title">BATTLE STATUS</div>
        <div class="turn-state${myTurn?'':' spectating'}">${esc(stateText)}</div>
        <div class="info-grid">
          <div><span>TURN</span><strong>${esc(room.match?.turnNumber ?? '—')}</strong></div>
          <div><span>TIME</span><strong>${room.status==='started'?remaining.toFixed(1)+'s':'—'}</strong></div>
          <div><span>ACTIVE</span><strong>${esc(active?.name ?? '—')}</strong></div>
          <div><span>WIND</span><strong>${arrow} ${esc(wind?.strength ?? 0)}</strong></div>
          <div><span>ANGLE</span><strong>${Math.round(room.match?.aimAngle ?? 45)}°</strong></div>
          <div><span>POWER</span><strong>${Math.round(room.match?.aimPower ?? 55)}%</strong></div>
          <div><span>JUMPS</span><strong>${esc(room.match?.jumpsRemaining ?? 0)} / 2</strong></div>
          <div><span>ALIVE</span><strong>${alive} / ${room.players?.length ?? 0}</strong></div>
          <div><span>BOXES</span><strong>${room.pickups?.length ?? 0}</strong></div>
          <div><span>HP</span><strong>${esc(me?.hp ?? 0)}</strong></div>
        </div>
      </section>
      <section class="info-block">
        <div class="info-block-title">CONTROLS</div>
        <div class="control-list">
          <div class="control-line"><span>${key('A')} ${key('D')} move</span><strong>±${esc(room.match?.movementRadius ?? 0)}</strong></div>
          <div class="control-line"><span>${key('SPACE')} jump</span><strong>${esc(room.match?.jumpsRemaining ?? 0)} left</strong></div>
          <div class="control-line"><span>${key('W')} ${key('S')} angle</span><strong>${Math.round(room.match?.aimAngle ?? 45)}°</strong></div>
          <div class="control-line"><span>${key('Q')} ${key('E')} power</span><strong>${Math.round(room.match?.aimPower ?? 55)}%</strong></div>
          <div class="control-line"><span>${key('F')} fire</span><strong>${projectile?'LOCKED':myTurn?'READY':'WAIT'}</strong></div>
        </div>
      </section>
      <section class="info-block">
        <div class="info-block-title">WEAPONS // MAX 3</div>
        <div class="weapon-list">
          ${weaponButton(1,'BASIC','always available',selected===1,false,false)}
          ${weaponButton(2,inv1?.label ?? 'EMPTY','inventory slot 1',selected===2,!inv1,true)}
          ${weaponButton(3,inv2?.label ?? 'EMPTY','inventory slot 2',selected===3,!inv2,true)}
        </div>
        <p class="pickup-note">Press 1, 2 or 3 — or click a weapon. Picking up a box does not auto-select it. Special weapons stay stored until you choose and fire them.</p>
      </section>`;
  }

  function update(room, playerId) {
    currentRoom = room;
    currentPlayerId = playerId;
    render();
  }

  timer = setInterval(render, 100);
  return Object.freeze({
    update,
    destroy() { if (timer) clearInterval(timer); timer = null; panel.innerHTML = ''; }
  });
}
