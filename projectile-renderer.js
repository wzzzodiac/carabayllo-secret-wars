// Future client-side projectile animation.
// The authoritative trajectory will be calculated by the server.
export function drawProjectile(ctx, point, radius = 5) {
  if (!point) return;
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
