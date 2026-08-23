export function createRenderer(canvas, config) {
  if (!(canvas instanceof HTMLCanvasElement)) throw new TypeError('A valid game canvas is required.');
  canvas.width = config.internalWidth;
  canvas.height = config.internalHeight;
  const ctx = canvas.getContext('2d');

  let animationFrame = null;
  let activeRoom = null;
  let localPlayerId = null;
  let cameraInitialized = false;
  let lastRoomStatus = null;
  let lastTargetPlayerId = null;
  let lastProjectileId = null;
  let dragging = false;
  let dragStart = null;

  const MIN_VIEW_UNITS = 1;
  const MAX_VIEW_UNITS = 5;
  const WORLD_UNITS = 5;
  const OPENING_DIVE_MS = 1800;
  const TURN_DIVE_MS = 900;
  const VEHICLE_WORLD_WIDTH = 28;
  const VEHICLE_WORLD_HEIGHT = 15;
  const PROJECTILE_GRAVITY = 480;
  const PREVIEW_SIM_DT = 0.02;
  const PREVIEW_MAX_SECONDS = 8;
  const PREVIEW_DOT_INTERVAL = 0.12;

  const TERRAIN_HOLES = Object.freeze({
    rolling: [],
    terraces: [[2430, 2550]],
    twinpeaks: [[2390, 2510]],
    basin: [[1140, 1240], [3760, 3860]],
    brokenridge: [[1010, 1140], [2410, 2550], [3860, 3980]],
    islands: [[900, 1040], [1920, 2080], [2910, 3070], [3960, 4110]],
    canyon: [[2380, 2580]]
  });

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = t => t * t * (3 - 2 * t);
  const gaussian = (x, center, width, amplitude) => amplitude * Math.exp(-((x - center) ** 2) / width);
  const plateau = (x, left, right, y, fallback) => (x >= left && x <= right ? y : fallback);

  function baseTerrainY(preset, x) {
    switch (preset) {
      case 'terraces': {
        let y = 3520 + Math.sin(x / 560) * 100;
        y = plateau(x, 330, 900, 3190, y);
        y = plateau(x, 1040, 1640, 2920, y);
        y = plateau(x, 1770, 2350, 3250, y);
        y = plateau(x, 2630, 3260, 2820, y);
        y = plateau(x, 3390, 3970, 3110, y);
        y = plateau(x, 4110, 4680, 2870, y);
        return y;
      }
      case 'twinpeaks': {
        let y = 3650 - gaussian(x, 1200, 260000, 850) - gaussian(x, 3820, 300000, 900);
        y += Math.sin(x / 280) * 60;
        if (x > 650 && x < 980) y = 3000;
        if (x > 1510 && x < 1850) y = 3170;
        if (x > 3150 && x < 3460) y = 3090;
        if (x > 4050 && x < 4410) y = 2890;
        return y;
      }
      case 'basin': {
        let y = 2870 + gaussian(x, 2500, 850000, 690) + Math.sin(x / 410) * 65;
        if (x > 420 && x < 950) y = 2750;
        if (x > 1320 && x < 1760) y = 3160;
        if (x > 3240 && x < 3680) y = 3160;
        if (x > 4050 && x < 4580) y = 2750;
        return y;
      }
      case 'brokenridge': {
        let y = 3490 + Math.sin(x / 210) * 170 + Math.sin(x / 690 + 1.1) * 130;
        if (x > 420 && x < 900) y = 3070;
        if (x > 1260 && x < 1720) y = 2740;
        if (x > 1900 && x < 2320) y = 3260;
        if (x > 2700 && x < 3160) y = 2860;
        if (x > 3330 && x < 3770) y = 3180;
        if (x > 4140 && x < 4620) y = 2780;
        return y;
      }
      case 'islands': {
        if (x < 900) return 3100 - gaussian(x, 520, 90000, 260);
        if (x < 1920) return 2840 - gaussian(x, 1470, 125000, 190);
        if (x < 2910) return 3260 - gaussian(x, 2480, 130000, 320);
        if (x < 3960) return 2760 - gaussian(x, 3470, 135000, 220);
        return 3160 - gaussian(x, 4540, 100000, 280);
      }
      case 'canyon': {
        let y = 2920 + Math.min(Math.abs(x - 2500) * 0.28, 700);
        if (x > 420 && x < 980) y = 2700;
        if (x > 1120 && x < 1640) y = 3030;
        if (x > 1800 && x < 2260) y = 3380;
        if (x > 2740 && x < 3200) y = 3380;
        if (x > 3360 && x < 3880) y = 3030;
        if (x > 4020 && x < 4580) y = 2700;
        return y;
      }
      default: {
        let y = 3440 + Math.sin(x / 470) * 165 + Math.sin(x / 980 + 0.7) * 95;
        if (x > 700 && x < 1120) y = 3140;
        if (x > 1760 && x < 2140) y = 2920;
        if (x > 2840 && x < 3240) y = 3170;
        if (x > 3890 && x < 4320) y = 2860;
        return y;
      }
    }
  }

  function terrainY(x, room = activeRoom) {
    const arena = room?.arena;
    const worldWidth = arena?.worldWidth ?? 5000;
    const worldHeight = arena?.worldHeight ?? 5000;
    const px = clamp(x, 0, worldWidth);
    const preset = room?.terrainPreset || arena?.terrainPreset || 'rolling';
    if ((TERRAIN_HOLES[preset] ?? []).some(([left, right]) => px >= left && px <= right)) return worldHeight;
    let y = baseTerrainY(preset, px);
    for (const crater of arena?.craters ?? []) {
      const dx = Math.abs(px - crater.x);
      if (dx < crater.radius) y += crater.depth * Math.sqrt(Math.max(0, 1 - (dx / crater.radius) ** 2));
    }
    return clamp(y, 120, worldHeight);
  }

  const camera = { centerX: 2500, centerY: 2500, viewUnits: MAX_VIEW_UNITS, targetCenterX: 2500, targetCenterY: 2500, targetViewUnits: MAX_VIEW_UNITS, manual: false, transition: null, projectileFollow: false };

  function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#071224');
    gradient.addColorStop(0.62, '#0a1221');
    gradient.addColorStop(1, '#02040a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < 90; i += 1) {
      const x = (i * 233 + 91) % canvas.width;
      const y = (i * 137 + 47) % Math.max(430, canvas.height * 0.62);
      const size = i % 9 === 0 ? 2 : 1;
      ctx.fillStyle = '#8cb4ff';
      ctx.fillRect(x, y, size, size);
    }
    ctx.restore();
  }

  function cancelLoop() { if (animationFrame) cancelAnimationFrame(animationFrame); animationFrame = null; }

  function drawScaffold() {
    cancelLoop(); activeRoom = null; cameraInitialized = false; lastRoomStatus = null; lastTargetPlayerId = null; lastProjectileId = null; camera.transition = null; camera.projectileFollow = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height); drawBackground();
    ctx.fillStyle = '#18243d'; ctx.beginPath(); ctx.moveTo(0, canvas.height * 0.72); ctx.quadraticCurveTo(canvas.width * 0.2, canvas.height * 0.58, canvas.width * 0.38, canvas.height * 0.70); ctx.quadraticCurveTo(canvas.width * 0.58, canvas.height * 0.84, canvas.width * 0.72, canvas.height * 0.63); ctx.quadraticCurveTo(canvas.width * 0.86, canvas.height * 0.50, canvas.width, canvas.height * 0.68); ctx.lineTo(canvas.width, canvas.height); ctx.lineTo(0, canvas.height); ctx.fill();
  }

  function cameraTarget(room) {
    const targetId = room.camera?.targetPlayerId || room.match?.activePlayerId || localPlayerId;
    return room.players.find(player => player.id === targetId) || room.players.find(player => player.id === localPlayerId) || room.players.find(player => player.alive !== false) || room.players[0] || null;
  }

  function viewSize(arena, units = camera.viewUnits) { const fraction = clamp(units, MIN_VIEW_UNITS, MAX_VIEW_UNITS) / WORLD_UNITS; return { width: arena.worldWidth * fraction, height: arena.worldHeight * fraction }; }
  function clampCenter(arena, centerX, centerY, units = camera.viewUnits) { const size = viewSize(arena, units); const halfW = size.width / 2; const halfH = size.height / 2; return { x: clamp(centerX, halfW, arena.worldWidth - halfW), y: clamp(centerY, halfH, arena.worldHeight - halfH) }; }
  function clampCamera(arena) { const current = clampCenter(arena, camera.centerX, camera.centerY, camera.viewUnits); camera.centerX = current.x; camera.centerY = current.y; const target = clampCenter(arena, camera.targetCenterX, camera.targetCenterY, camera.targetViewUnits); camera.targetCenterX = target.x; camera.targetCenterY = target.y; }

  function setFullMap(room) {
    camera.manual = false; camera.projectileFollow = false; camera.transition = null; camera.viewUnits = MAX_VIEW_UNITS; camera.targetViewUnits = MAX_VIEW_UNITS; camera.centerX = room.arena.worldWidth / 2; camera.centerY = room.arena.worldHeight / 2; camera.targetCenterX = camera.centerX; camera.targetCenterY = camera.centerY; cameraInitialized = true; clampCamera(room.arena);
  }

  function setFollowTarget(room, immediate = false) {
    const target = cameraTarget(room); if (!target?.spawn || !room.arena) return; camera.targetCenterX = target.spawn.x; camera.targetCenterY = target.spawn.y; if (immediate) { camera.centerX = target.spawn.x; camera.centerY = target.spawn.y; } clampCamera(room.arena);
  }

  function beginTargetTransition(room, durationMs, now = performance.now()) {
    const target = cameraTarget(room); if (!target?.spawn) return; const destination = clampCenter(room.arena, target.spawn.x, target.spawn.y, MIN_VIEW_UNITS); camera.manual = false; camera.projectileFollow = false; camera.transition = { startedAt: now, endsAt: now + durationMs, fromCenterX: camera.centerX, fromCenterY: camera.centerY, fromViewUnits: camera.viewUnits, toCenterX: destination.x, toCenterY: destination.y, toViewUnits: MIN_VIEW_UNITS }; camera.targetCenterX = destination.x; camera.targetCenterY = destination.y; camera.targetViewUnits = MIN_VIEW_UNITS;
  }

  function projectilePosition(projectile, now = Date.now()) {
    if (!projectile) return null; const elapsedMs = clamp(now - projectile.startedAt, 0, projectile.durationMs); const t = elapsedMs / 1000; return { x: projectile.startX + projectile.vx * t + 0.5 * projectile.windAccel * t * t, y: projectile.startY + projectile.vy * t + 0.5 * projectile.gravity * t * t, impact: now >= projectile.impactAt };
  }

  function controlsLocked(now = performance.now()) { return activeRoom?.status === 'countdown' || activeRoom?.status === 'lobby' || Boolean(camera.transition && now < camera.transition.endsAt) || Boolean(activeRoom?.match?.projectile); }

  function ensureCameraState(room) {
    if (!room?.arena) return;
    const targetId = room.camera?.targetPlayerId || room.match?.activePlayerId || null;
    const projectileId = room.match?.projectile?.id || null;
    if (room.status === 'lobby') { if (!cameraInitialized || lastRoomStatus !== 'lobby') setFullMap(room); lastRoomStatus = 'lobby'; lastTargetPlayerId = null; lastProjectileId = null; return; }
    if (!cameraInitialized) { if (room.status === 'countdown') setFullMap(room); else { camera.viewUnits = MIN_VIEW_UNITS; camera.targetViewUnits = MIN_VIEW_UNITS; setFollowTarget(room, true); cameraInitialized = true; } }
    if (lastRoomStatus === 'lobby' && room.status === 'countdown') setFullMap(room);
    if (lastRoomStatus === 'countdown' && room.status === 'started') beginTargetTransition(room, OPENING_DIVE_MS);
    else if (room.status === 'started' && lastTargetPlayerId && targetId && targetId !== lastTargetPlayerId && !projectileId) beginTargetTransition(room, TURN_DIVE_MS);
    if (projectileId && projectileId !== lastProjectileId) { camera.manual = false; camera.transition = null; camera.projectileFollow = true; camera.targetViewUnits = MIN_VIEW_UNITS; }
    if (!projectileId && lastProjectileId) camera.projectileFollow = false;
    lastRoomStatus = room.status; if (targetId) lastTargetPlayerId = targetId; lastProjectileId = projectileId;
  }

  function currentView(arena) { const size = viewSize(arena); return { x: camera.centerX - size.width / 2, y: camera.centerY - size.height / 2, width: size.width, height: size.height }; }
  function worldToScreen(x, y, view) { return { x: (x - view.x) / view.width * canvas.width, y: (y - view.y) / view.height * canvas.height }; }
  function screenToWorld(x, y, arena) { const view = currentView(arena); return { x: view.x + x / canvas.width * view.width, y: view.y + y / canvas.height * view.height }; }

  function updateCamera(room, now) {
    if (!room?.arena || room.status === 'lobby' || room.status === 'countdown') return;
    const projectile = room.match?.projectile;
    if (projectile && camera.projectileFollow) {
      const position = projectilePosition(projectile);
      if (position) { const centered = clampCenter(room.arena, position.x, position.y, MIN_VIEW_UNITS); camera.targetCenterX = centered.x; camera.targetCenterY = centered.y; camera.targetViewUnits = MIN_VIEW_UNITS; camera.centerX = lerp(camera.centerX, centered.x, 0.22); camera.centerY = lerp(camera.centerY, centered.y, 0.22); camera.viewUnits = lerp(camera.viewUnits, MIN_VIEW_UNITS, 0.18); clampCamera(room.arena); return; }
    }
    if (camera.transition) {
      const transition = camera.transition; const raw = clamp((now - transition.startedAt) / (transition.endsAt - transition.startedAt), 0, 1); const t = smoothstep(raw); camera.centerX = lerp(transition.fromCenterX, transition.toCenterX, t); camera.centerY = lerp(transition.fromCenterY, transition.toCenterY, t); camera.viewUnits = lerp(transition.fromViewUnits, transition.toViewUnits, t); if (raw >= 1) { camera.centerX = transition.toCenterX; camera.centerY = transition.toCenterY; camera.viewUnits = transition.toViewUnits; camera.targetCenterX = transition.toCenterX; camera.targetCenterY = transition.toCenterY; camera.targetViewUnits = transition.toViewUnits; camera.transition = null; } clampCamera(room.arena); return;
    }
    if (!camera.manual && room.status === 'started') setFollowTarget(room, false);
    camera.centerX = lerp(camera.centerX, camera.targetCenterX, 0.16); camera.centerY = lerp(camera.centerY, camera.targetCenterY, 0.16); camera.viewUnits = lerp(camera.viewUnits, camera.targetViewUnits, 0.14); if (Math.abs(camera.viewUnits - camera.targetViewUnits) < 0.002) camera.viewUnits = camera.targetViewUnits; if (Math.abs(camera.centerX - camera.targetCenterX) < 0.2) camera.centerX = camera.targetCenterX; if (Math.abs(camera.centerY - camera.targetCenterY) < 0.2) camera.centerY = camera.targetCenterY; clampCamera(room.arena);
  }

  function visualPlayerPosition(player, now = Date.now()) {
    const motion = player.motion; if (!motion || now >= motion.endsAt) return player.spawn; const raw = clamp((now - motion.startedAt) / (motion.endsAt - motion.startedAt), 0, 1); const x = lerp(motion.fromX, motion.toX, raw); const baseY = lerp(motion.fromY, motion.toY, raw); const arc = motion.type === 'jump' ? Math.sin(Math.PI * raw) * (motion.apex || 0) : 0; return { ...player.spawn, x, y: baseY - arc };
  }

  function drawTerrain(room, view) {
    const step = 5; ctx.save(); ctx.fillStyle = '#18243d';
    for (let screenX = 0; screenX < canvas.width; screenX += step) { const worldX = view.x + (screenX / canvas.width) * view.width; const worldY = terrainY(worldX, room); if (worldY >= room.arena.worldHeight - 1) continue; const screenY = worldToScreen(worldX, worldY, view).y; ctx.fillRect(screenX, screenY, step + 1, canvas.height - screenY); }
    ctx.restore(); ctx.save(); ctx.strokeStyle = 'rgba(140,180,255,.20)'; ctx.lineWidth = 1; ctx.beginPath(); let drawing = false;
    for (let screenX = 0; screenX <= canvas.width; screenX += step) { const worldX = view.x + (screenX / canvas.width) * view.width; const worldY = terrainY(worldX, room); if (worldY >= room.arena.worldHeight - 1) { drawing = false; continue; } const screenY = worldToScreen(worldX, worldY, view).y; if (!drawing) { ctx.moveTo(screenX, screenY); drawing = true; } else ctx.lineTo(screenX, screenY); }
    ctx.stroke(); ctx.restore();
  }

  function drawPreviewSpawns(room, view) {
    if (room.status !== 'lobby') return; const positions = room.arena?.previewSpawns ?? []; ctx.save();
    positions.forEach((x, index) => { const y = terrainY(x, room); if (y >= room.arena.worldHeight - 1) return; const point = worldToScreen(x, y - 18, view); ctx.strokeStyle = 'rgba(255,232,154,.75)'; ctx.fillStyle = 'rgba(255,232,154,.13)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(point.x, point.y, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#ffe89a'; ctx.font = '700 11px ui-monospace,monospace'; ctx.textAlign = 'center'; ctx.fillText(String(index + 1), point.x, point.y + 4); });
    ctx.restore();
  }

  function drawVehicle(room, player, position, view, local, active) {
    if (!position) return; const screen = worldToScreen(position.x, position.y, view); if (screen.x < -90 || screen.x > canvas.width + 90 || screen.y < -90 || screen.y > canvas.height + 90) return; const pxPerWorldX = canvas.width / view.width; const pxPerWorldY = canvas.height / view.height; const vehicleW = clamp(VEHICLE_WORLD_WIDTH * pxPerWorldX, 8, 52); const vehicleH = clamp(VEHICLE_WORLD_HEIGHT * pxPerWorldY, 5, 30); const wheelR = clamp(vehicleH * 0.28, 2, 7); const cannonLength = clamp(vehicleW * 0.48, 6, 22); const cannonThickness = clamp(vehicleH * 0.16, 2, 5); const aimAngle = active ? (room.match?.aimAngle ?? 45) : 15;
    ctx.save(); ctx.translate(screen.x, screen.y); ctx.scale(position.facing || 1, 1); ctx.globalAlpha = player.alive === false ? 0.55 : 1; ctx.fillStyle = room.mode === 'survival' ? '#d6b4ff' : player.team === 'A' ? '#8cb4ff' : '#ff9aa8'; ctx.strokeStyle = active ? '#ffe89a' : local ? '#ffffff' : 'rgba(231,237,255,.55)'; ctx.lineWidth = active ? 3 : local ? 2.5 : 1.5; ctx.beginPath(); ctx.roundRect(-vehicleW / 2, -vehicleH * 0.62, vehicleW, vehicleH, Math.max(2, vehicleH * 0.25)); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#08101d'; ctx.beginPath(); ctx.arc(-vehicleW * 0.27, vehicleH * 0.24, wheelR, 0, Math.PI * 2); ctx.arc(vehicleW * 0.27, vehicleH * 0.24, wheelR, 0, Math.PI * 2); ctx.fill(); ctx.save(); ctx.translate(vehicleW * 0.08, -vehicleH * 0.72); ctx.rotate(-aimAngle * Math.PI / 180); ctx.fillRect(0, -cannonThickness / 2, cannonLength, cannonThickness); ctx.restore(); ctx.restore();
    if (camera.viewUnits <= 3.25 || active || local) { const offset = Math.max(22, vehicleH * 1.65); ctx.textAlign = 'center'; ctx.fillStyle = '#e7edff'; ctx.font = '700 15px ui-monospace,monospace'; ctx.fillText(player.name, screen.x, screen.y - offset); ctx.font = '700 10px ui-monospace,monospace'; ctx.fillStyle = player.alive === false ? '#ff9aa8' : active ? '#ffe89a' : '#8cb4ff'; const role = player.alive === false ? 'OUT' : room.mode === 'survival' ? 'SURVIVAL' : `TEAM ${player.team}`; const flags = `${local ? ' // YOU' : ''}${active ? ' // ACTIVE' : ''}`; ctx.fillText(`${role}${flags}`, screen.x, screen.y - offset + 15); }
  }

  function drawAimPreview(room, view) {
    if (room.status !== 'started' || room.match?.projectile || room.match?.activePlayerId !== localPlayerId) return; const player = room.players.find(entry => entry.id === localPlayerId); if (!player?.spawn || player.alive === false) return;
    const position = visualPlayerPosition(player); const facing = position.facing || 1; const angle = room.match?.aimAngle ?? 45; const power = room.match?.aimPower ?? 55; const radians = angle * Math.PI / 180; const speed = 320 + power * 9; const startX = position.x + facing * 24; const startY = position.y - 24; const vx = Math.cos(radians) * speed * facing; const vy = -Math.sin(radians) * speed; const windAccel = (room.match?.wind?.signed ?? 0) * 1.5; const dots = []; let nextDotAt = 0; let impact = null;
    for (let t = PREVIEW_SIM_DT; t <= PREVIEW_MAX_SECONDS; t += PREVIEW_SIM_DT) { const x = startX + vx * t + 0.5 * windAccel * t * t; const y = startY + vy * t + 0.5 * PROJECTILE_GRAVITY * t * t; if (t >= nextDotAt) { dots.push({ x, y }); nextDotAt += PREVIEW_DOT_INTERVAL; } if (x < 0 || x > room.arena.worldWidth || y > room.arena.worldHeight) { impact = { x: clamp(x, 0, room.arena.worldWidth), y }; break; } const surface = terrainY(x, room); if (surface < room.arena.worldHeight && t > 0.08 && y >= surface) { impact = { x: clamp(x, 0, room.arena.worldWidth), y: surface }; break; } }
    ctx.save(); ctx.fillStyle = 'rgba(255,232,154,.66)'; dots.forEach((dot, index) => { const point = worldToScreen(dot.x, dot.y, view); if (point.x < -12 || point.x > canvas.width + 12 || point.y < -12 || point.y > canvas.height + 12) return; ctx.globalAlpha = 0.34 + Math.min(index / Math.max(dots.length, 1), 1) * 0.34; ctx.beginPath(); ctx.arc(point.x, point.y, index % 4 === 0 ? 3.1 : 2.2, 0, Math.PI * 2); ctx.fill(); }); if (impact) { const marker = worldToScreen(impact.x, impact.y, view); if (marker.x >= -30 && marker.x <= canvas.width + 30 && marker.y >= -30 && marker.y <= canvas.height + 30) { ctx.globalAlpha = 0.82; ctx.strokeStyle = '#ffe89a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(marker.x, marker.y, 9, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(marker.x - 13, marker.y); ctx.lineTo(marker.x + 13, marker.y); ctx.moveTo(marker.x, marker.y - 13); ctx.lineTo(marker.x, marker.y + 13); ctx.stroke(); } } ctx.restore();
  }

  function drawProjectile(room, view) {
    const projectile = room.match?.projectile; if (!projectile) return; const now = Date.now(); const position = projectilePosition(projectile, now); if (!position) return; ctx.save(); ctx.strokeStyle = 'rgba(255,232,154,.38)'; ctx.lineWidth = 2; ctx.beginPath(); const trailStart = Math.max(projectile.startedAt, now - 420); for (let sample = trailStart; sample <= Math.min(now, projectile.impactAt); sample += 35) { const point = projectilePosition(projectile, sample); const screen = worldToScreen(point.x, point.y, view); if (sample === trailStart) ctx.moveTo(screen.x, screen.y); else ctx.lineTo(screen.x, screen.y); } ctx.stroke(); const screen = worldToScreen(position.x, position.y, view); ctx.fillStyle = '#ffe89a'; ctx.beginPath(); ctx.arc(screen.x, screen.y, 7, 0, Math.PI * 2); ctx.fill(); if (now >= projectile.impactAt) { const impact = worldToScreen(projectile.impactX, projectile.impactY, view); const age = clamp((now - projectile.impactAt) / 650, 0, 1); ctx.globalAlpha = 1 - age; ctx.strokeStyle = '#fff0a8'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(impact.x, impact.y, 14 + age * 45, 0, Math.PI * 2); ctx.stroke(); } ctx.restore();
  }

  function nextPlayer(room) { const order = room.match?.turnOrder ?? []; if (!order.length || room.match?.turnIndex == null) return null; for (let offset = 1; offset <= order.length; offset += 1) { const id = order[(room.match.turnIndex + offset) % order.length]; const player = room.players.find(entry => entry.id === id); if (player?.alive !== false) return player; } return null; }
  function visiblePlayerCount(room, view) { return room.players.filter(player => player.spawn && player.spawn.x >= view.x && player.spawn.x <= view.x + view.width && player.spawn.y >= view.y && player.spawn.y <= view.y + view.height).length; }

  function drawCameraHud(room, target, view) {
    if (room.status === 'lobby') return; const local = room.players.find(player => player.id === localPlayerId); const zoomLabel = camera.viewUnits.toFixed(camera.viewUnits % 1 < 0.03 ? 0 : 1); const modeLabel = room.mode === 'survival' ? 'SURVIVAL' : 'TEAM'; const locked = controlsLocked(); const viewMode = room.match?.projectile ? 'PROJECTILE CAM' : locked ? 'CAMERA LOCKED' : camera.manual ? 'FREE CAMERA' : 'FOLLOW CAMERA'; ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(7,10,18,.84)'; ctx.fillRect(24, 24, 610, 126); ctx.strokeStyle = 'rgba(155,184,255,.25)'; ctx.strokeRect(24, 24, 610, 126); ctx.fillStyle = '#8cb4ff'; ctx.font = '700 13px ui-monospace,monospace'; ctx.fillText(`PHASE 5A // ${modeLabel} // ${viewMode}`, 42, 50); ctx.fillStyle = '#e7edff'; ctx.font = '700 14px ui-monospace,monospace'; ctx.fillText(`OBSERVING: ${target?.name ?? '—'}${target?.id === localPlayerId ? ' (YOU)' : ''}`, 42, 76); ctx.fillStyle = '#8995b8'; ctx.font = '12px ui-monospace,monospace'; ctx.fillText(`view ${zoomLabel}x${zoomLabel} of world 5x5 // ${room.arena.terrainName ?? room.terrainPreset}`, 42, 100); ctx.fillText(locked ? 'camera controls temporarily locked' : 'drag = pan // wheel = zoom 1x1..5x5 // double click = follow active', 42, 122); ctx.fillText(`you: ${local?.name ?? '—'} // visible players: ${visiblePlayerCount(room, view)}/${room.players.length}`, 42, 142);
  }

  function drawTurnHud(room) {
    if (room.status !== 'started' || !room.match?.activePlayerId) return; const active = room.players.find(player => player.id === room.match.activePlayerId); const next = nextPlayer(room); const projectile = room.match.projectile; const remainingMs = Math.max(0, (room.match.turnEndsAt ?? Date.now()) - Date.now()); const remaining = (remainingMs / 1000).toFixed(1); const wind = room.match.wind; const arrow = wind?.direction === 'left' ? '←' : wind?.direction === 'right' ? '→' : '·'; const localTurn = room.match.activePlayerId === localPlayerId; const alive = room.players.filter(player => player.alive !== false).length; const x = canvas.width - 444; ctx.textAlign = 'left'; ctx.fillStyle = localTurn ? 'rgba(30,42,22,.90)' : 'rgba(7,10,18,.88)'; ctx.fillRect(x, 24, 420, 205); ctx.strokeStyle = localTurn ? 'rgba(166,255,135,.55)' : 'rgba(255,232,154,.35)'; ctx.strokeRect(x, 24, 420, 205); ctx.fillStyle = localTurn ? '#a6ff87' : '#ffe89a'; ctx.font = '800 16px ui-monospace,monospace'; ctx.fillText(projectile ? 'SHOT IN FLIGHT' : localTurn ? 'YOUR TURN' : 'SPECTATING', x + 18, 50); ctx.fillStyle = '#e7edff'; ctx.font = '700 14px ui-monospace,monospace'; ctx.fillText(`TURN ${room.match.turnNumber ?? 1} // ACTIVE: ${active?.name ?? '—'}`, x + 18, 78); ctx.fillStyle = '#8cb4ff'; ctx.font = '800 22px ui-monospace,monospace'; ctx.fillText(projectile ? `IMPACT ${remaining}s` : `TIME ${remaining}s`, x + 18, 108); ctx.fillStyle = '#e7edff'; ctx.font = '700 14px ui-monospace,monospace'; ctx.fillText(`WIND ${arrow} ${wind?.strength ?? 0}`, x + 220, 108); ctx.fillStyle = '#8995b8'; ctx.font = '12px ui-monospace,monospace'; ctx.fillText(`MOVE ±${room.match.movementRadius ?? 0} // JUMPS ${room.match.jumpsRemaining ?? 0}/2`, x + 18, 136); ctx.fillText(`ANGLE ${Math.round(room.match.aimAngle ?? 45)}° // POWER ${Math.round(room.match.aimPower ?? 55)}%`, x + 220, 136); ctx.fillText(`NEXT: ${next?.name ?? '—'} // ALIVE ${alive}/${room.players.length}`, x + 18, 160); ctx.fillText(`CRATERS ${room.arena.craters?.length ?? 0} // ${room.arena.terrainName ?? room.terrainPreset}`, x + 18, 183); ctx.fillText(localTurn && !projectile ? 'A/D move // SPACE jump // W/S angle // Q/E power // F fire' : projectile ? 'Camera follows projectile until impact.' : 'Wait for your turn; camera remains available.', x + 18, 208);
  }

  function drawLobbyHud(room) {
    if (room.status !== 'lobby') return; ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(7,10,18,.78)'; ctx.fillRect(canvas.width / 2 - 330, 26, 660, 82); ctx.strokeStyle = 'rgba(140,180,255,.28)'; ctx.strokeRect(canvas.width / 2 - 330, 26, 660, 82); ctx.fillStyle = '#e7edff'; ctx.font = '800 18px ui-monospace,monospace'; ctx.fillText(room.arena.terrainName ?? room.terrainPreset, canvas.width / 2, 56); ctx.fillStyle = '#8cb4ff'; ctx.font = '700 12px ui-monospace,monospace'; ctx.fillText('LIVE TERRAIN PREVIEW // numbered markers show approximately even player spacing', canvas.width / 2, 80); ctx.fillStyle = '#8995b8'; ctx.fillText('Host can change terrain before READY / START', canvas.width / 2, 98); ctx.restore();
  }

  function drawCountdownOverlay(room) {
    const elapsed = Date.now() - (room.match?.countdownStartedAt ?? Date.now()); const count = 6 - Math.floor(elapsed / 1000); const label = elapsed < 1000 ? 'GET READY' : count > 0 ? String(count) : 'START'; ctx.fillStyle = 'rgba(2,4,10,.44)'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.textAlign = 'center'; ctx.fillStyle = '#e7edff'; ctx.font = '800 76px system-ui,sans-serif'; ctx.fillText(label, canvas.width / 2, canvas.height / 2); ctx.font = '700 18px ui-monospace,monospace'; ctx.fillStyle = '#8cb4ff'; ctx.fillText(`${room.arena.terrainName ?? room.terrainPreset} // FULL MAP OVERVIEW`, canvas.width / 2, canvas.height / 2 + 54); ctx.font = '12px ui-monospace,monospace'; ctx.fillStyle = '#8995b8'; ctx.fillText('Movement is limited; cliffs and gaps may require one of your two jumps', canvas.width / 2, canvas.height / 2 + 82);
  }

  function drawWorld(room) {
    const view = currentView(room.arena); const target = cameraTarget(room); ctx.clearRect(0, 0, canvas.width, canvas.height); drawBackground(); drawTerrain(room, view); drawPreviewSpawns(room, view); if (room.status === 'started') drawAimPreview(room, view); for (const player of room.players) { if (!player.spawn) continue; drawVehicle(room, player, visualPlayerPosition(player), view, player.id === localPlayerId, player.id === room.match?.activePlayerId); } if (room.status === 'started') drawProjectile(room, view); drawCameraHud(room, target, view); drawTurnHud(room); drawLobbyHud(room);
  }

  function frame(now) { if (!activeRoom?.arena) return; ensureCameraState(activeRoom); updateCamera(activeRoom, now); drawWorld(activeRoom); if (activeRoom.status === 'countdown') drawCountdownOverlay(activeRoom); animationFrame = requestAnimationFrame(frame); }

  function drawArena(room, nextLocalPlayerId = null) {
    localPlayerId = nextLocalPlayerId; activeRoom = room; if (!room?.arena || !['lobby', 'countdown', 'started'].includes(room.status)) { drawScaffold(); return; } ensureCameraState(room); if (!animationFrame) animationFrame = requestAnimationFrame(frame);
  }

  function pointerPosition(event) { const rect = canvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) / rect.width * canvas.width, y: (event.clientY - rect.top) / rect.height * canvas.height }; }

  canvas.addEventListener('pointerdown', event => { if (!activeRoom?.arena || controlsLocked()) return; dragging = true; canvas.setPointerCapture?.(event.pointerId); const point = pointerPosition(event); dragStart = { ...point, centerX: camera.centerX, centerY: camera.centerY }; camera.manual = true; });
  canvas.addEventListener('pointermove', event => { if (!dragging || !dragStart || !activeRoom?.arena || controlsLocked()) return; const point = pointerPosition(event); const size = viewSize(activeRoom.arena); camera.targetCenterX = dragStart.centerX - (point.x - dragStart.x) / canvas.width * size.width; camera.targetCenterY = dragStart.centerY - (point.y - dragStart.y) / canvas.height * size.height; camera.centerX = camera.targetCenterX; camera.centerY = camera.targetCenterY; clampCamera(activeRoom.arena); });
  function stopDragging(event) { dragging = false; dragStart = null; if (event?.pointerId != null) canvas.releasePointerCapture?.(event.pointerId); }
  canvas.addEventListener('pointerup', stopDragging); canvas.addEventListener('pointercancel', stopDragging); canvas.addEventListener('pointerleave', event => { if (dragging && event.buttons === 0) stopDragging(event); });
  canvas.addEventListener('wheel', event => { if (!activeRoom?.arena || controlsLocked()) return; event.preventDefault(); const arena = activeRoom.arena; const point = pointerPosition(event); const before = screenToWorld(point.x, point.y, arena); const direction = event.deltaY > 0 ? 1 : -1; const nextUnits = clamp(camera.viewUnits + direction * 0.35, MIN_VIEW_UNITS, MAX_VIEW_UNITS); if (Math.abs(nextUnits - camera.viewUnits) < 0.001) return; camera.manual = true; camera.viewUnits = nextUnits; camera.targetViewUnits = nextUnits; const newSize = viewSize(arena, nextUnits); camera.centerX = before.x - (point.x / canvas.width - 0.5) * newSize.width; camera.centerY = before.y - (point.y / canvas.height - 0.5) * newSize.height; camera.targetCenterX = camera.centerX; camera.targetCenterY = camera.centerY; clampCamera(arena); }, { passive: false });
  canvas.addEventListener('dblclick', () => { if (!activeRoom?.arena || controlsLocked()) return; camera.manual = false; camera.targetViewUnits = MIN_VIEW_UNITS; setFollowTarget(activeRoom, false); });

  return Object.freeze({ drawScaffold, drawArena });
}
