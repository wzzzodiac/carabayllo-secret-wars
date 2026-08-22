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
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = t => t * t * (3 - 2 * t);
  const terrainY = x => 3370 + Math.sin(x / 430) * 180 + Math.sin(x / 970 + 0.7) * 130;

  const camera = {
    centerX: 2500, centerY: 2500, viewUnits: MAX_VIEW_UNITS,
    targetCenterX: 2500, targetCenterY: 2500, targetViewUnits: MAX_VIEW_UNITS,
    manual: false, transition: null, projectileFollow: false
  };

  function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#071224');
    gradient.addColorStop(.62, '#0a1221');
    gradient.addColorStop(1, '#02040a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.globalAlpha = .55;
    for (let i = 0; i < 90; i += 1) {
      const x = (i * 233 + 91) % canvas.width;
      const y = (i * 137 + 47) % Math.max(430, canvas.height * .62);
      const size = i % 9 === 0 ? 2 : 1;
      ctx.fillStyle = '#8cb4ff';
      ctx.fillRect(x, y, size, size);
    }
    ctx.restore();
  }

  function cancelLoop() { if (animationFrame) cancelAnimationFrame(animationFrame); animationFrame = null; }

  function drawScaffold() {
    cancelLoop();
    activeRoom = null;
    cameraInitialized = false;
    lastRoomStatus = null;
    lastTargetPlayerId = null;
    lastProjectileId = null;
    camera.transition = null;
    camera.projectileFollow = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    ctx.fillStyle = '#18243d';
    ctx.beginPath();
    ctx.moveTo(0, canvas.height * .72);
    ctx.quadraticCurveTo(canvas.width * .2, canvas.height * .58, canvas.width * .38, canvas.height * .70);
    ctx.quadraticCurveTo(canvas.width * .58, canvas.height * .84, canvas.width * .72, canvas.height * .63);
    ctx.quadraticCurveTo(canvas.width * .86, canvas.height * .50, canvas.width, canvas.height * .68);
    ctx.lineTo(canvas.width, canvas.height);
    ctx.lineTo(0, canvas.height);
    ctx.fill();
  }

  function cameraTarget(room) {
    const targetId = room.camera?.targetPlayerId || room.match?.activePlayerId || localPlayerId;
    return room.players.find(player => player.id === targetId)
      || room.players.find(player => player.id === localPlayerId)
      || room.players[0]
      || null;
  }

  function viewSize(arena, units = camera.viewUnits) {
    const fraction = clamp(units, MIN_VIEW_UNITS, MAX_VIEW_UNITS) / WORLD_UNITS;
    return { width: arena.worldWidth * fraction, height: arena.worldHeight * fraction };
  }

  function clampCenter(arena, centerX, centerY, units = camera.viewUnits) {
    const size = viewSize(arena, units);
    const halfW = size.width / 2;
    const halfH = size.height / 2;
    return { x: clamp(centerX, halfW, arena.worldWidth - halfW), y: clamp(centerY, halfH, arena.worldHeight - halfH) };
  }

  function clampCamera(arena) {
    const current = clampCenter(arena, camera.centerX, camera.centerY, camera.viewUnits);
    camera.centerX = current.x;
    camera.centerY = current.y;
    const target = clampCenter(arena, camera.targetCenterX, camera.targetCenterY, camera.targetViewUnits);
    camera.targetCenterX = target.x;
    camera.targetCenterY = target.y;
  }

  function setFollowTarget(room, immediate = false) {
    const target = cameraTarget(room);
    if (!target?.spawn || !room.arena) return;
    camera.targetCenterX = target.spawn.x;
    camera.targetCenterY = target.spawn.y;
    if (immediate) {
      camera.centerX = camera.targetCenterX;
      camera.centerY = camera.targetCenterY;
    }
    clampCamera(room.arena);
  }

  function beginCountdownOverview(room) {
    camera.manual = false;
    camera.projectileFollow = false;
    camera.transition = null;
    camera.viewUnits = MAX_VIEW_UNITS;
    camera.targetViewUnits = MAX_VIEW_UNITS;
    camera.centerX = room.arena.worldWidth / 2;
    camera.centerY = room.arena.worldHeight / 2;
    camera.targetCenterX = camera.centerX;
    camera.targetCenterY = camera.centerY;
    cameraInitialized = true;
    clampCamera(room.arena);
  }

  function beginTargetTransition(room, durationMs, now = performance.now()) {
    const target = cameraTarget(room);
    if (!target?.spawn) return;
    const clampedTarget = clampCenter(room.arena, target.spawn.x, target.spawn.y, MIN_VIEW_UNITS);
    camera.manual = false;
    camera.projectileFollow = false;
    camera.transition = {
      startedAt: now,
      endsAt: now + durationMs,
      fromCenterX: camera.centerX,
      fromCenterY: camera.centerY,
      fromViewUnits: camera.viewUnits,
      toCenterX: clampedTarget.x,
      toCenterY: clampedTarget.y,
      toViewUnits: MIN_VIEW_UNITS
    };
    camera.targetCenterX = clampedTarget.x;
    camera.targetCenterY = clampedTarget.y;
    camera.targetViewUnits = MIN_VIEW_UNITS;
  }

  function projectilePosition(projectile, now = Date.now()) {
    if (!projectile) return null;
    const elapsedMs = clamp(now - projectile.startedAt, 0, projectile.durationMs);
    const t = elapsedMs / 1000;
    return {
      x: projectile.startX + projectile.vx * t + 0.5 * projectile.windAccel * t * t,
      y: projectile.startY + projectile.vy * t + 0.5 * projectile.gravity * t * t,
      impact: now >= projectile.impactAt
    };
  }

  function controlsLocked(now = performance.now()) {
    return activeRoom?.status === 'countdown'
      || Boolean(camera.transition && now < camera.transition.endsAt)
      || Boolean(activeRoom?.match?.projectile);
  }

  function ensureCameraState(room) {
    if (!room?.arena) return;
    const targetId = room.camera?.targetPlayerId || room.match?.activePlayerId || null;
    const projectileId = room.match?.projectile?.id || null;

    if (!cameraInitialized) {
      if (room.status === 'countdown') beginCountdownOverview(room);
      else {
        camera.viewUnits = MIN_VIEW_UNITS;
        camera.targetViewUnits = MIN_VIEW_UNITS;
        setFollowTarget(room, true);
        cameraInitialized = true;
      }
    }

    if (lastRoomStatus === 'countdown' && room.status === 'started') beginTargetTransition(room, OPENING_DIVE_MS);
    else if (room.status === 'started' && lastTargetPlayerId && targetId && targetId !== lastTargetPlayerId && !projectileId) beginTargetTransition(room, TURN_DIVE_MS);

    if (projectileId && projectileId !== lastProjectileId) {
      camera.manual = false;
      camera.transition = null;
      camera.projectileFollow = true;
      camera.targetViewUnits = MIN_VIEW_UNITS;
    }
    if (!projectileId && lastProjectileId) camera.projectileFollow = false;
    if (room.status === 'countdown' && lastRoomStatus !== 'countdown') beginCountdownOverview(room);

    lastRoomStatus = room.status;
    if (targetId) lastTargetPlayerId = targetId;
    lastProjectileId = projectileId;
  }

  function currentView(arena) {
    const size = viewSize(arena);
    return { x: camera.centerX - size.width / 2, y: camera.centerY - size.height / 2, width: size.width, height: size.height };
  }

  function worldToScreen(x, y, view) {
    return { x: (x - view.x) / view.width * canvas.width, y: (y - view.y) / view.height * canvas.height };
  }

  function screenToWorld(x, y, arena) {
    const view = currentView(arena);
    return { x: view.x + x / canvas.width * view.width, y: view.y + y / canvas.height * view.height };
  }

  function updateCamera(room, now) {
    if (!room?.arena) return;

    const projectile = room.match?.projectile;
    if (projectile && camera.projectileFollow) {
      const pos = projectilePosition(projectile);
      if (pos) {
        const clamped = clampCenter(room.arena, pos.x, pos.y, MIN_VIEW_UNITS);
        camera.targetCenterX = clamped.x;
        camera.targetCenterY = clamped.y;
        camera.targetViewUnits = MIN_VIEW_UNITS;
        camera.centerX = lerp(camera.centerX, camera.targetCenterX, .22);
        camera.centerY = lerp(camera.centerY, camera.targetCenterY, .22);
        camera.viewUnits = lerp(camera.viewUnits, camera.targetViewUnits, .18);
        clampCamera(room.arena);
        return;
      }
    }

    if (camera.transition) {
      const transition = camera.transition;
      const rawT = clamp((now - transition.startedAt) / (transition.endsAt - transition.startedAt), 0, 1);
      const t = smoothstep(rawT);
      camera.centerX = lerp(transition.fromCenterX, transition.toCenterX, t);
      camera.centerY = lerp(transition.fromCenterY, transition.toCenterY, t);
      camera.viewUnits = lerp(transition.fromViewUnits, transition.toViewUnits, t);
      if (rawT >= 1) {
        camera.centerX = transition.toCenterX;
        camera.centerY = transition.toCenterY;
        camera.viewUnits = transition.toViewUnits;
        camera.targetCenterX = transition.toCenterX;
        camera.targetCenterY = transition.toCenterY;
        camera.targetViewUnits = transition.toViewUnits;
        camera.transition = null;
      }
      clampCamera(room.arena);
      return;
    }

    if (!camera.manual && room.status === 'started') setFollowTarget(room, false);
    camera.centerX = lerp(camera.centerX, camera.targetCenterX, .16);
    camera.centerY = lerp(camera.centerY, camera.targetCenterY, .16);
    camera.viewUnits = lerp(camera.viewUnits, camera.targetViewUnits, .14);
    if (Math.abs(camera.viewUnits - camera.targetViewUnits) < .002) camera.viewUnits = camera.targetViewUnits;
    if (Math.abs(camera.centerX - camera.targetCenterX) < .2) camera.centerX = camera.targetCenterX;
    if (Math.abs(camera.centerY - camera.targetCenterY) < .2) camera.centerY = camera.targetCenterY;
    clampCamera(room.arena);
  }

  function visualPlayerPosition(player, now = Date.now()) {
    const motion = player.motion;
    if (!motion || motion.type !== 'jump' || now >= motion.endsAt) return player.spawn;
    const raw = clamp((now - motion.startedAt) / (motion.endsAt - motion.startedAt), 0, 1);
    const x = lerp(motion.fromX, motion.toX, raw);
    const baseY = lerp(motion.fromY, motion.toY, raw);
    const arc = Math.sin(Math.PI * raw) * motion.apex;
    return { ...player.spawn, x, y: baseY - arc };
  }

  function drawVehicle(room, player, position, view, local, active) {
    const screen = worldToScreen(position.x, position.y, view);
    if (screen.x < -90 || screen.x > canvas.width + 90 || screen.y < -90 || screen.y > canvas.height + 90) return;
    const pxPerWorldX = canvas.width / view.width;
    const pxPerWorldY = canvas.height / view.height;
    const vehicleW = clamp(VEHICLE_WORLD_WIDTH * pxPerWorldX, 8, 52);
    const vehicleH = clamp(VEHICLE_WORLD_HEIGHT * pxPerWorldY, 5, 30);
    const wheelR = clamp(vehicleH * .28, 2, 7);
    const cannonLength = clamp(vehicleW * .48, 6, 22);
    const cannonThickness = clamp(vehicleH * .16, 2, 5);
    const aimAngle = active ? (room.match?.aimAngle ?? 45) : 15;

    ctx.save();
    ctx.translate(screen.x, screen.y);
    ctx.scale(position.facing || 1, 1);
    ctx.fillStyle = room.mode === 'survival' ? '#d6b4ff' : player.team === 'A' ? '#8cb4ff' : '#ff9aa8';
    ctx.strokeStyle = active ? '#ffe89a' : local ? '#ffffff' : 'rgba(231,237,255,.55)';
    ctx.lineWidth = active ? 3 : local ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.roundRect(-vehicleW / 2, -vehicleH * .62, vehicleW, vehicleH, Math.max(2, vehicleH * .25));
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#08101d';
    ctx.beginPath();
    ctx.arc(-vehicleW * .27, vehicleH * .24, wheelR, 0, Math.PI * 2);
    ctx.arc(vehicleW * .27, vehicleH * .24, wheelR, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(vehicleW * .08, -vehicleH * .72);
    ctx.rotate(-aimAngle * Math.PI / 180);
    ctx.fillRect(0, -cannonThickness / 2, cannonLength, cannonThickness);
    ctx.restore();
    ctx.restore();

    if (camera.viewUnits <= 3.25 || active || local) {
      const labelOffset = Math.max(22, vehicleH * 1.65);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#e7edff';
      ctx.font = '700 15px ui-monospace,monospace';
      ctx.fillText(player.name, screen.x, screen.y - labelOffset);
      ctx.font = '700 10px ui-monospace,monospace';
      ctx.fillStyle = active ? '#ffe89a' : '#8cb4ff';
      const role = room.mode === 'survival' ? 'SURVIVAL' : `TEAM ${player.team}`;
      const flags = `${local ? ' // YOU' : ''}${active ? ' // ACTIVE' : ''}`;
      ctx.fillText(`${role}${flags}`, screen.x, screen.y - labelOffset + 15);
    }
  }

  function drawProjectile(room, view) {
    const projectile = room.match?.projectile;
    if (!projectile) return;
    const now = Date.now();
    const pos = projectilePosition(projectile, now);
    if (!pos) return;

    ctx.save();
    ctx.strokeStyle = 'rgba(255,232,154,.38)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const trailStart = Math.max(projectile.startedAt, now - 420);
    for (let sample = trailStart; sample <= Math.min(now, projectile.impactAt); sample += 35) {
      const p = projectilePosition(projectile, sample);
      const s = worldToScreen(p.x, p.y, view);
      if (sample === trailStart) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
    }
    ctx.stroke();

    const s = worldToScreen(pos.x, pos.y, view);
    ctx.fillStyle = '#ffe89a';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 18;
    ctx.shadowColor = '#ffe89a';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
    ctx.fill();

    if (now >= projectile.impactAt) {
      const impact = worldToScreen(projectile.impactX, projectile.impactY, view);
      const age = clamp((now - projectile.impactAt) / 650, 0, 1);
      const radius = 14 + age * 45;
      ctx.globalAlpha = 1 - age;
      ctx.strokeStyle = '#fff0a8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(impact.x, impact.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function visiblePlayerCount(room, view) {
    return room.players.filter(player => player.spawn
      && player.spawn.x >= view.x && player.spawn.x <= view.x + view.width
      && player.spawn.y >= view.y && player.spawn.y <= view.y + view.height).length;
  }

  function nextPlayer(room) {
    const order = room.match?.turnOrder ?? [];
    if (!order.length || room.match?.turnIndex == null) return null;
    const nextId = order[(room.match.turnIndex + 1) % order.length];
    return room.players.find(player => player.id === nextId) ?? null;
  }

  function drawMovementRadius(room, view) {
    if (room.status !== 'started' || !room.match?.activePlayerId || room.match?.projectile) return;
    const active = room.players.find(player => player.id === room.match.activePlayerId);
    if (!active?.spawn || room.match.movementOriginX == null) return;
    const y = terrainY(room.match.movementOriginX) - 4;
    const left = worldToScreen(room.match.movementOriginX - room.match.movementRadius, y, view);
    const right = worldToScreen(room.match.movementOriginX + room.match.movementRadius, y, view);
    ctx.save();
    ctx.strokeStyle = 'rgba(166,255,135,.20)';
    ctx.setLineDash([8, 8]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left.x, left.y);
    ctx.lineTo(right.x, right.y);
    ctx.stroke();
    ctx.restore();
  }

  function drawCameraHud(room, target, view) {
    const local = room.players.find(player => player.id === localPlayerId);
    const zoomLabel = camera.viewUnits.toFixed(camera.viewUnits % 1 < .03 ? 0 : 1);
    const modeLabel = room.mode === 'survival' ? 'SURVIVAL' : 'TEAM';
    const locked = controlsLocked();
    const viewMode = room.match?.projectile ? 'PROJECTILE CAM' : locked ? 'CAMERA LOCKED' : camera.manual ? 'FREE CAMERA' : 'FOLLOW CAMERA';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(7,10,18,.84)';
    ctx.fillRect(24, 24, 610, 126);
    ctx.strokeStyle = 'rgba(155,184,255,.25)';
    ctx.strokeRect(24, 24, 610, 126);
    ctx.fillStyle = '#8cb4ff';
    ctx.font = '700 13px ui-monospace,monospace';
    ctx.fillText(`PHASE 4 // ${modeLabel} // ${viewMode}`, 42, 50);
    ctx.fillStyle = '#e7edff';
    ctx.font = '700 14px ui-monospace,monospace';
    ctx.fillText(`OBSERVING: ${target?.name ?? '—'}${target?.id === localPlayerId ? ' (YOU)' : ''}`, 42, 76);
    ctx.fillStyle = '#8995b8';
    ctx.font = '12px ui-monospace,monospace';
    ctx.fillText(`view ${zoomLabel}x${zoomLabel} of world 5x5 // center ${Math.round(camera.centerX)}, ${Math.round(camera.centerY)}`, 42, 100);
    ctx.fillText(locked ? 'camera controls temporarily locked' : 'drag = pan // wheel = zoom 1x1..5x5 // double click = follow active', 42, 122);
    ctx.fillText(`you: ${local?.name ?? '—'} // visible players: ${visiblePlayerCount(room, view)}/${room.players.length}`, 42, 142);
  }

  function drawTurnHud(room) {
    if (room.status !== 'started' || !room.match?.activePlayerId) return;
    const active = room.players.find(player => player.id === room.match.activePlayerId);
    const next = nextPlayer(room);
    const projectile = room.match.projectile;
    const remainingMs = Math.max(0, (room.match.turnEndsAt ?? Date.now()) - Date.now());
    const remaining = (remainingMs / 1000).toFixed(1);
    const wind = room.match.wind;
    const arrow = wind?.direction === 'left' ? '←' : wind?.direction === 'right' ? '→' : '·';
    const localTurn = room.match.activePlayerId === localPlayerId;
    const x = canvas.width - 444;

    ctx.textAlign = 'left';
    ctx.fillStyle = localTurn ? 'rgba(30,42,22,.90)' : 'rgba(7,10,18,.88)';
    ctx.fillRect(x, 24, 420, 188);
    ctx.strokeStyle = localTurn ? 'rgba(166,255,135,.55)' : 'rgba(255,232,154,.35)';
    ctx.strokeRect(x, 24, 420, 188);
    ctx.fillStyle = localTurn ? '#a6ff87' : '#ffe89a';
    ctx.font = '800 16px ui-monospace,monospace';
    ctx.fillText(projectile ? 'SHOT IN FLIGHT' : localTurn ? 'YOUR TURN' : 'SPECTATING', x + 18, 50);
    ctx.fillStyle = '#e7edff';
    ctx.font = '700 14px ui-monospace,monospace';
    ctx.fillText(`TURN ${room.match.turnNumber ?? 1} // ACTIVE: ${active?.name ?? '—'}`, x + 18, 78);
    ctx.fillStyle = '#8cb4ff';
    ctx.font = '800 22px ui-monospace,monospace';
    ctx.fillText(projectile ? `IMPACT ${remaining}s` : `TIME ${remaining}s`, x + 18, 108);
    ctx.fillStyle = '#e7edff';
    ctx.font = '700 14px ui-monospace,monospace';
    ctx.fillText(`WIND ${arrow} ${wind?.strength ?? 0}`, x + 220, 108);
    ctx.fillStyle = '#8995b8';
    ctx.font = '12px ui-monospace,monospace';
    ctx.fillText(`MOVE ±${room.match.movementRadius ?? 0} // JUMPS ${room.match.jumpsRemaining ?? 0}/2`, x + 18, 136);
    ctx.fillText(`ANGLE ${Math.round(room.match.aimAngle ?? 45)}° // POWER ${Math.round(room.match.aimPower ?? 55)}%`, x + 220, 136);
    ctx.fillText(`NEXT: ${next?.name ?? '—'}`, x + 18, 160);
    ctx.fillText(localTurn && !projectile ? 'A/D move // SPACE jump // W/S angle // Q/E power // F fire' : projectile ? 'Camera follows the projectile until impact.' : 'Wait for your turn; camera remains available.', x + 18, 186);
  }

  function drawWorld(room) {
    const arena = room.arena;
    const view = currentView(arena);
    const target = cameraTarget(room);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();

    ctx.fillStyle = '#18243d';
    ctx.beginPath();
    for (let sx = 0; sx <= canvas.width; sx += 12) {
      const wx = view.x + (sx / canvas.width) * view.width;
      const sy = worldToScreen(wx, terrainY(wx), view).y;
      if (sx === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    }
    ctx.lineTo(canvas.width, canvas.height);
    ctx.lineTo(0, canvas.height);
    ctx.fill();

    drawMovementRadius(room, view);
    for (const player of room.players) {
      if (!player.spawn) continue;
      drawVehicle(room, player, visualPlayerPosition(player), view, player.id === localPlayerId, player.id === room.match?.activePlayerId);
    }
    drawProjectile(room, view);
    drawCameraHud(room, target, view);
    drawTurnHud(room);
  }

  function countdownLabel(room) {
    const elapsed = Date.now() - (room.match?.countdownStartedAt ?? Date.now());
    if (elapsed < 1000) return 'GET READY';
    const n = 6 - Math.floor(elapsed / 1000);
    return n > 0 ? String(n) : 'START';
  }

  function drawCountdownOverlay(room) {
    ctx.fillStyle = 'rgba(2,4,10,.44)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e7edff';
    ctx.font = '800 76px system-ui,sans-serif';
    ctx.fillText(countdownLabel(room), canvas.width / 2, canvas.height / 2);
    ctx.font = '700 18px ui-monospace,monospace';
    ctx.fillStyle = '#8cb4ff';
    ctx.fillText(room.mode === 'survival' ? 'SURVIVAL MODE // FULL MAP OVERVIEW' : 'TEAM MODE // FULL MAP OVERVIEW', canvas.width / 2, canvas.height / 2 + 54);
    ctx.font = '12px ui-monospace,monospace';
    ctx.fillStyle = '#8995b8';
    ctx.fillText('Turn 1 starts with movement, two jumps, aiming and one shot', canvas.width / 2, canvas.height / 2 + 82);
  }

  function frame(now) {
    if (!activeRoom?.arena) return;
    ensureCameraState(activeRoom);
    updateCamera(activeRoom, now);
    drawWorld(activeRoom);
    if (activeRoom.status === 'countdown') drawCountdownOverlay(activeRoom);
    animationFrame = requestAnimationFrame(frame);
  }

  function drawArena(room, nextLocalPlayerId = null) {
    localPlayerId = nextLocalPlayerId;
    activeRoom = room;
    if (!room?.arena || !['countdown', 'started'].includes(room.status)) {
      drawScaffold();
      return;
    }
    ensureCameraState(room);
    if (!animationFrame) animationFrame = requestAnimationFrame(frame);
  }

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width * canvas.width, y: (event.clientY - rect.top) / rect.height * canvas.height };
  }

  canvas.addEventListener('pointerdown', event => {
    if (!activeRoom?.arena || controlsLocked()) return;
    dragging = true;
    canvas.setPointerCapture?.(event.pointerId);
    const p = pointerPosition(event);
    dragStart = { ...p, centerX: camera.centerX, centerY: camera.centerY };
    camera.manual = true;
  });

  canvas.addEventListener('pointermove', event => {
    if (!dragging || !dragStart || !activeRoom?.arena || controlsLocked()) return;
    const p = pointerPosition(event);
    const size = viewSize(activeRoom.arena);
    camera.targetCenterX = dragStart.centerX - (p.x - dragStart.x) / canvas.width * size.width;
    camera.targetCenterY = dragStart.centerY - (p.y - dragStart.y) / canvas.height * size.height;
    camera.centerX = camera.targetCenterX;
    camera.centerY = camera.targetCenterY;
    clampCamera(activeRoom.arena);
  });

  function stopDragging(event) {
    dragging = false;
    dragStart = null;
    if (event?.pointerId != null) canvas.releasePointerCapture?.(event.pointerId);
  }

  canvas.addEventListener('pointerup', stopDragging);
  canvas.addEventListener('pointercancel', stopDragging);
  canvas.addEventListener('pointerleave', event => { if (dragging && event.buttons === 0) stopDragging(event); });

  canvas.addEventListener('wheel', event => {
    if (!activeRoom?.arena || controlsLocked()) return;
    event.preventDefault();
    const arena = activeRoom.arena;
    const p = pointerPosition(event);
    const before = screenToWorld(p.x, p.y, arena);
    const direction = event.deltaY > 0 ? 1 : -1;
    const nextUnits = clamp(camera.viewUnits + direction * .35, MIN_VIEW_UNITS, MAX_VIEW_UNITS);
    if (Math.abs(nextUnits - camera.viewUnits) < .001) return;
    camera.manual = true;
    camera.viewUnits = nextUnits;
    camera.targetViewUnits = nextUnits;
    const newSize = viewSize(arena, nextUnits);
    camera.centerX = before.x - (p.x / canvas.width - .5) * newSize.width;
    camera.centerY = before.y - (p.y / canvas.height - .5) * newSize.height;
    camera.targetCenterX = camera.centerX;
    camera.targetCenterY = camera.centerY;
    clampCamera(arena);
  }, { passive: false });

  canvas.addEventListener('dblclick', () => {
    if (!activeRoom?.arena || controlsLocked()) return;
    camera.manual = false;
    camera.targetViewUnits = MIN_VIEW_UNITS;
    setFollowTarget(activeRoom, false);
  });

  return Object.freeze({ drawScaffold, drawArena });
}
