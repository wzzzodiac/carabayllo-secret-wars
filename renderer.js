import { drawTerrainScaffold } from './terrain-renderer.js';

export function createRenderer(canvas, config) {
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new TypeError('A valid game canvas is required.');
  }

  canvas.width = config.internalWidth;
  canvas.height = config.internalHeight;
  const ctx = canvas.getContext('2d');

  function drawScaffold() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#071224');
    gradient.addColorStop(1, '#02040a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawTerrainScaffold(ctx, canvas.width, canvas.height);
  }

  return Object.freeze({ drawScaffold });
}
