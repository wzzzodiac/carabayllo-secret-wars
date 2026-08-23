export function initCombatControls(gameCanvas) {
  if (!(gameCanvas instanceof HTMLCanvasElement)) throw new TypeError('A valid game canvas is required.');

  const parent = gameCanvas.parentElement;
  if (!parent) throw new Error('Game canvas needs a parent element.');
  if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';

  const panel = document.createElement('div');
  panel.setAttribute('aria-live', 'polite');
  Object.assign(panel.style, {
    position: 'absolute',
    left: '50%',
    bottom: '18px',
    transform: 'translateX(-50%)',
    zIndex: '3',
    minWidth: '620px',
    maxWidth: 'calc(100% - 32px)',
    padding: '12px 16px',
    border: '1px solid rgba(166,255,135,.42)',
    borderRadius: '10px',
    background: 'rgba(7,10,18,.88)',
    boxShadow: '0 10px 30px rgba(0,0,0,.30)',
    color: '#e7edff',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    fontSize: '12px',
    lineHeight: '1.45',
    pointerEvents: 'none',
    userSelect: 'none',
    textAlign: 'center',
    display: 'none'
  });
  parent.appendChild(panel);

  const key = value => `<span style="display:inline-block;min-width:24px;padding:1px 6px;margin:0 2px;border:1px solid rgba(140,180,255,.42);border-radius:5px;background:rgba(140,180,255,.10);color:#dce7ff;font-weight:800">${value}</span>`;

  function update(room, playerId) {
    const active = room?.status === 'started' && room.match?.activePlayerId === playerId;
    if (!active) {
      panel.style.display = 'none';
      return;
    }

    panel.style.display = 'block';
    const projectile = room.match?.projectile;
    if (projectile) {
      panel.style.borderColor = 'rgba(255,232,154,.45)';
      panel.innerHTML = '<strong style="color:#ffe89a">SHOT IN FLIGHT</strong> // camera following projectile';
      return;
    }

    panel.style.borderColor = 'rgba(166,255,135,.42)';
    const angle = Math.round(room.match?.aimAngle ?? 45);
    const power = Math.round(room.match?.aimPower ?? 55);
    const jumps = room.match?.jumpsRemaining ?? 0;
    panel.innerHTML = `
      <div style="margin-bottom:6px;color:#a6ff87;font-weight:800;letter-spacing:.08em">YOUR CONTROLS</div>
      <div>${key('A')} ${key('D')} MOVE &nbsp;&nbsp; ${key('SPACE')} JUMP <strong>${jumps}/2</strong> &nbsp;&nbsp; ${key('W')} ${key('S')} ANGLE <strong>${angle}°</strong> &nbsp;&nbsp; ${key('Q')} ${key('E')} POWER <strong>${power}%</strong> &nbsp;&nbsp; ${key('F')} <strong style="color:#ffe89a">FIRE</strong></div>`;
  }

  return Object.freeze({
    update,
    destroy() { panel.remove(); }
  });
}
