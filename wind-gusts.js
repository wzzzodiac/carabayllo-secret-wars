export function initWindGusts(gameCanvas) {
  if (!(gameCanvas instanceof HTMLCanvasElement)) throw new TypeError('A valid game canvas is required.');

  const parent = gameCanvas.parentElement;
  if (!parent) throw new Error('Game canvas needs a parent element.');
  if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';

  const canvas = document.createElement('canvas');
  canvas.width = gameCanvas.width;
  canvas.height = gameCanvas.height;
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '1'
  });
  parent.insertBefore(canvas, gameCanvas.nextSibling);

  const ctx = canvas.getContext('2d');
  let room = null;
  let frame = null;

  const fract = value => value - Math.floor(value);
  const hash = value => fract(Math.sin(value * 91.733 + 17.17) * 43758.5453);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function drawGusts() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const wind = room?.match?.wind;
    if (room?.status === 'started' && wind && room.match?.turnStartedAt) {
      const elapsed = Math.max(0, Date.now() - room.match.turnStartedAt) / 1000;
      const turn = room.match.turnNumber ?? 1;
      const direction = wind.direction === 'left' ? -1 : 1;
      const strength = clamp(wind.strength ?? 0, 0, 60);
      const gustCount = 3 + Math.floor(strength / 22);

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(194, 218, 255, 0.65)';

      for (let i = 0; i < gustCount; i += 1) {
        const seed = turn * 17 + i * 31;
        const cycleSeconds = 5.2 + hash(seed) * 3.2;
        const phase = fract((elapsed + hash(seed + 2) * cycleSeconds) / cycleSeconds);
        const visibleWindow = 0.22 + strength / 520;
        if (phase > visibleWindow) continue;

        const local = phase / visibleWindow;
        const fade = Math.sin(Math.PI * local);
        const travel = direction > 0 ? local : 1 - local;
        const centerX = (-0.15 + travel * 1.30) * canvas.width;
        const yBase = (0.20 + hash(seed + 5) * 0.48) * canvas.height;
        const length = (0.07 + hash(seed + 7) * 0.10 + strength / 850) * canvas.width;
        const bend = (hash(seed + 11) - 0.5) * canvas.height * 0.025;
        const strands = strength > 38 ? 3 : 2;

        ctx.globalAlpha = (0.12 + strength / 260) * fade;
        ctx.lineWidth = 1.4 + strength / 45;

        for (let strand = 0; strand < strands; strand += 1) {
          const offsetY = (strand - (strands - 1) / 2) * (5 + hash(seed + strand + 19) * 5);
          const startX = centerX - direction * length * 0.5;
          const endX = centerX + direction * length * 0.5;
          ctx.beginPath();
          ctx.moveTo(startX, yBase + offsetY);
          ctx.bezierCurveTo(
            centerX - direction * length * 0.15,
            yBase + offsetY + bend,
            centerX + direction * length * 0.12,
            yBase + offsetY - bend * 0.55,
            endX,
            yBase + offsetY
          );
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    frame = requestAnimationFrame(drawGusts);
  }

  frame = requestAnimationFrame(drawGusts);

  return Object.freeze({
    update(nextRoom) { room = nextRoom; },
    destroy() {
      if (frame) cancelAnimationFrame(frame);
      canvas.remove();
    }
  });
}
