import { drawTerrainScaffold } from './terrain-renderer.js';

export function createRenderer(canvas, config) {
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new TypeError('A valid game canvas is required.');
  }

  canvas.width = config.internalWidth;
  canvas.height = config.internalHeight;
  const ctx = canvas.getContext('2d');

  function drawBackground() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#071224');
    gradient.addColorStop(0.62, '#0a1221');
    gradient.addColorStop(1, '#02040a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < 70; i += 1) {
      const x = (i * 233 + 91) % canvas.width;
      const y = (i * 137 + 47) % 430;
      const size = i % 9 === 0 ? 2 : 1;
      ctx.fillStyle = '#8cb4ff';
      ctx.fillRect(x, y, size, size);
    }
    ctx.restore();
  }

  function drawScaffold() {
    drawBackground();
    drawTerrainScaffold(ctx, canvas.width, canvas.height);
  }

  function drawArena(room, localPlayerId = null) {
    if (room?.status !== 'started' || !room?.arena) {
      drawScaffold();
      return;
    }

    drawBackground();
    drawTerrainScaffold(ctx, canvas.width, canvas.height);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const player of room.players) {
      if (!player.spawn) continue;
      const { x, y, facing } = player.spawn;
      const isLocal = player.id === localPlayerId;
      const teamLabel = player.team === 'A' ? 'A' : 'B';

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(facing || 1, 1);

      ctx.fillStyle = player.team === 'A' ? '#8cb4ff' : '#ff9aa8';
      ctx.strokeStyle = isLocal ? '#ffffff' : 'rgba(231,237,255,.55)';
      ctx.lineWidth = isLocal ? 5 : 3;
      ctx.beginPath();
      ctx.roundRect(-42, -26, 84, 43, 14);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#08101d';
      ctx.fillRect(9, -36, 40, 8);
      ctx.beginPath();
      ctx.arc(-24, 20, 12, 0, Math.PI * 2);
      ctx.arc(24, 20, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.font = '700 18px ui-monospace, monospace';
      ctx.fillStyle = '#e7edff';
      ctx.fillText(player.name, x, y - 58);
      ctx.font = '700 13px ui-monospace, monospace';
      ctx.fillStyle = player.team === 'A' ? '#8cb4ff' : '#ff9aa8';
      ctx.fillText(`TEAM ${teamLabel}${isLocal ? ' // YOU' : ''}`, x, y - 38);
    }

    ctx.restore();

    ctx.save();
    ctx.fillStyle = 'rgba(7,10,18,.74)';
    ctx.fillRect(24, 24, 360, 64);
    ctx.strokeStyle = 'rgba(155,184,255,.25)';
    ctx.strokeRect(24, 24, 360, 64);
    ctx.fillStyle = '#8cb4ff';
    ctx.font = '700 13px ui-monospace, monospace';
    ctx.fillText('PHASE 2 // SYNCHRONIZED SPAWN TEST', 42, 50);
    ctx.fillStyle = '#8995b8';
    ctx.font = '12px ui-monospace, monospace';
    ctx.fillText(`${room.players.length} players // arena ${room.arena.id}`, 42, 72);
    ctx.restore();
  }

  return Object.freeze({ drawScaffold, drawArena });
}
