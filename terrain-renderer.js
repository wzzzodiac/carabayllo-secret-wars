export function drawTerrainScaffold(ctx, width, height) {
  ctx.save();
  ctx.fillStyle = '#18243d';
  ctx.beginPath();
  ctx.moveTo(0, height * 0.72);
  ctx.quadraticCurveTo(width * 0.20, height * 0.58, width * 0.38, height * 0.70);
  ctx.quadraticCurveTo(width * 0.58, height * 0.84, width * 0.72, height * 0.63);
  ctx.quadraticCurveTo(width * 0.86, height * 0.50, width, height * 0.68);
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
