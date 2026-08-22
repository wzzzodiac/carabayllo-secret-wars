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
  let dragging = false;
  let dragStart = null;

  const MIN_VIEW_UNITS = 1;
  const MAX_VIEW_UNITS = 5;
  const WORLD_UNITS = 5;
  const OPENING_DIVE_MS = 1800;
  const TURN_DIVE_MS = 900;
  const VEHICLE_WORLD_WIDTH = 28;
  const VEHICLE_WORLD_HEIGHT = 15;

  const camera = { centerX: 2500, centerY: 2500, viewUnits: MAX_VIEW_UNITS, targetCenterX: 2500, targetCenterY: 2500, targetViewUnits: MAX_VIEW_UNITS, manual: false, transition: null };
  const terrainY = worldX => 3370 + Math.sin(worldX / 430) * 180 + Math.sin(worldX / 970 + 0.7) * 130;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = t => t * t * (3 - 2 * t);

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height); g.addColorStop(0, '#071224'); g.addColorStop(.62, '#0a1221'); g.addColorStop(1, '#02040a'); ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save(); ctx.globalAlpha = .55; for (let i = 0; i < 90; i += 1) { const x = (i * 233 + 91) % canvas.width, y = (i * 137 + 47) % Math.max(430, canvas.height * .62), size = i % 9 === 0 ? 2 : 1; ctx.fillStyle = '#8cb4ff'; ctx.fillRect(x, y, size, size); } ctx.restore();
  }

  function cancelLoop() { if (animationFrame) cancelAnimationFrame(animationFrame); animationFrame = null; }
  function drawScaffold() { cancelLoop(); activeRoom = null; cameraInitialized = false; lastRoomStatus = null; lastTargetPlayerId = null; camera.transition = null; ctx.clearRect(0, 0, canvas.width, canvas.height); drawBackground(); ctx.fillStyle = '#18243d'; ctx.beginPath(); ctx.moveTo(0, canvas.height * .72); ctx.quadraticCurveTo(canvas.width * .2, canvas.height * .58, canvas.width * .38, canvas.height * .70); ctx.quadraticCurveTo(canvas.width * .58, canvas.height * .84, canvas.width * .72, canvas.height * .63); ctx.quadraticCurveTo(canvas.width * .86, canvas.height * .50, canvas.width, canvas.height * .68); ctx.lineTo(canvas.width, canvas.height); ctx.lineTo(0, canvas.height); ctx.fill(); }

  function cameraTarget(room) { const targetId = room.camera?.targetPlayerId || room.match?.activePlayerId || localPlayerId; return room.players.find(player => player.id === targetId) || room.players.find(player => player.id === localPlayerId) || room.players[0] || null; }
  function viewSize(arena, units = camera.viewUnits) { const fraction = clamp(units, MIN_VIEW_UNITS, MAX_VIEW_UNITS) / WORLD_UNITS; return { width: arena.worldWidth * fraction, height: arena.worldHeight * fraction }; }
  function clampCenter(arena, centerX, centerY, units = camera.viewUnits) { const size = viewSize(arena, units), halfW = size.width / 2, halfH = size.height / 2; return { x: clamp(centerX, halfW, arena.worldWidth - halfW), y: clamp(centerY, halfH, arena.worldHeight - halfH) }; }
  function clampCamera(arena) { const current = clampCenter(arena, camera.centerX, camera.centerY, camera.viewUnits); camera.centerX = current.x; camera.centerY = current.y; const target = clampCenter(arena, camera.targetCenterX, camera.targetCenterY, camera.targetViewUnits); camera.targetCenterX = target.x; camera.targetCenterY = target.y; }
  function setFollowTarget(room, immediate = false) { const target = cameraTarget(room); if (!target?.spawn || !room.arena) return; camera.targetCenterX = target.spawn.x; camera.targetCenterY = target.spawn.y; if (immediate) { camera.centerX = camera.targetCenterX; camera.centerY = camera.targetCenterY; } clampCamera(room.arena); }
  function beginCountdownOverview(room) { camera.manual = false; camera.transition = null; camera.viewUnits = MAX_VIEW_UNITS; camera.targetViewUnits = MAX_VIEW_UNITS; camera.centerX = room.arena.worldWidth / 2; camera.centerY = room.arena.worldHeight / 2; camera.targetCenterX = camera.centerX; camera.targetCenterY = camera.centerY; cameraInitialized = true; clampCamera(room.arena); }
  function beginTargetTransition(room, durationMs, now = performance.now()) { const target = cameraTarget(room); if (!target?.spawn) return; const clampedTarget = clampCenter(room.arena, target.spawn.x, target.spawn.y, MIN_VIEW_UNITS); camera.manual = false; camera.transition = { startedAt: now, endsAt: now + durationMs, fromCenterX: camera.centerX, fromCenterY: camera.centerY, fromViewUnits: camera.viewUnits, toCenterX: clampedTarget.x, toCenterY: clampedTarget.y, toViewUnits: MIN_VIEW_UNITS }; camera.targetCenterX = clampedTarget.x; camera.targetCenterY = clampedTarget.y; camera.targetViewUnits = MIN_VIEW_UNITS; }
  function controlsLocked(now = performance.now()) { return activeRoom?.status === 'countdown' || Boolean(camera.transition && now < camera.transition.endsAt); }

  function ensureCameraState(room) {
    if (!room?.arena) return;
    const targetId = room.camera?.targetPlayerId || room.match?.activePlayerId || null;
    if (!cameraInitialized) { if (room.status === 'countdown') beginCountdownOverview(room); else { camera.viewUnits = MIN_VIEW_UNITS; camera.targetViewUnits = MIN_VIEW_UNITS; setFollowTarget(room, true); cameraInitialized = true; } }
    if (lastRoomStatus === 'countdown' && room.status === 'started') beginTargetTransition(room, OPENING_DIVE_MS);
    else if (room.status === 'started' && lastTargetPlayerId && targetId && targetId !== lastTargetPlayerId) beginTargetTransition(room, TURN_DIVE_MS);
    if (room.status === 'countdown' && lastRoomStatus !== 'countdown') beginCountdownOverview(room);
    lastRoomStatus = room.status; if (targetId) lastTargetPlayerId = targetId;
  }

  function currentView(arena) { const size = viewSize(arena); return { x: camera.centerX - size.width / 2, y: camera.centerY - size.height / 2, width: size.width, height: size.height }; }
  function worldToScreen(x, y, view) { return { x: (x - view.x) / view.width * canvas.width, y: (y - view.y) / view.height * canvas.height }; }
  function screenToWorld(x, y, arena) { const view = currentView(arena); return { x: view.x + x / canvas.width * view.width, y: view.y + y / canvas.height * view.height }; }

  function updateCamera(room, now) {
    if (!room?.arena) return;
    if (camera.transition) { const transition = camera.transition, rawT = clamp((now - transition.startedAt) / (transition.endsAt - transition.startedAt), 0, 1), t = smoothstep(rawT); camera.centerX = lerp(transition.fromCenterX, transition.toCenterX, t); camera.centerY = lerp(transition.fromCenterY, transition.toCenterY, t); camera.viewUnits = lerp(transition.fromViewUnits, transition.toViewUnits, t); if (rawT >= 1) { camera.centerX = transition.toCenterX; camera.centerY = transition.toCenterY; camera.viewUnits = transition.toViewUnits; camera.targetCenterX = transition.toCenterX; camera.targetCenterY = transition.toCenterY; camera.targetViewUnits = transition.toViewUnits; camera.transition = null; } clampCamera(room.arena); return; }
    if (!camera.manual && room.status === 'started') setFollowTarget(room, false);
    camera.centerX = lerp(camera.centerX, camera.targetCenterX, .16); camera.centerY = lerp(camera.centerY, camera.targetCenterY, .16); camera.viewUnits = lerp(camera.viewUnits, camera.targetViewUnits, .14);
    if (Math.abs(camera.viewUnits - camera.targetViewUnits) < .002) camera.viewUnits = camera.targetViewUnits; if (Math.abs(camera.centerX - camera.targetCenterX) < .2) camera.centerX = camera.targetCenterX; if (Math.abs(camera.centerY - camera.targetCenterY) < .2) camera.centerY = camera.targetCenterY; clampCamera(room.arena);
  }

  function drawVehicle(room, player, screen, view, local, active) {
    const pxPerWorldX = canvas.width / view.width, pxPerWorldY = canvas.height / view.height, vehicleW = clamp(VEHICLE_WORLD_WIDTH * pxPerWorldX, 8, 52), vehicleH = clamp(VEHICLE_WORLD_HEIGHT * pxPerWorldY, 5, 30), wheelR = clamp(vehicleH * .28, 2, 7), cannonLength = clamp(vehicleW * .42, 5, 18), cannonThickness = clamp(vehicleH * .16, 2, 5);
    ctx.save(); ctx.translate(screen.x, screen.y); ctx.scale(player.spawn.facing || 1, 1); ctx.fillStyle = room.mode === 'survival' ? '#d6b4ff' : player.team === 'A' ? '#8cb4ff' : '#ff9aa8'; ctx.strokeStyle = active ? '#ffe89a' : local ? '#ffffff' : 'rgba(231,237,255,.55)'; ctx.lineWidth = active ? 3 : local ? 2.5 : 1.5; ctx.beginPath(); ctx.roundRect(-vehicleW / 2, -vehicleH * .62, vehicleW, vehicleH, Math.max(2, vehicleH * .25)); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#08101d'; ctx.fillRect(vehicleW * .08, -vehicleH * .83, cannonLength, cannonThickness); ctx.beginPath(); ctx.arc(-vehicleW * .27, vehicleH * .24, wheelR, 0, Math.PI * 2); ctx.arc(vehicleW * .27, vehicleH * .24, wheelR, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    if (camera.viewUnits <= 3.25 || active || local) { const labelOffset = Math.max(22, vehicleH * 1.65); ctx.textAlign = 'center'; ctx.fillStyle = '#e7edff'; ctx.font = '700 15px ui-monospace,monospace'; ctx.fillText(player.name, screen.x, screen.y - labelOffset); ctx.font = '700 10px ui-monospace,monospace'; ctx.fillStyle = active ? '#ffe89a' : '#8cb4ff'; const role = room.mode === 'survival' ? 'SURVIVAL' : `TEAM ${player.team}`, flags = `${local ? ' // YOU' : ''}${active ? ' // ACTIVE' : ''}`; ctx.fillText(`${role}${flags}`, screen.x, screen.y - labelOffset + 15); }
  }

  function visiblePlayerCount(room, view) { return room.players.filter(player => player.spawn && player.spawn.x >= view.x && player.spawn.x <= view.x + view.width && player.spawn.y >= view.y && player.spawn.y <= view.y + view.height).length; }
  function nextPlayer(room) { const order = room.match?.turnOrder ?? []; if (!order.length || room.match?.turnIndex == null) return null; const nextId = order[(room.match.turnIndex + 1) % order.length]; return room.players.find(player => player.id === nextId) ?? null; }

  function drawCameraHud(room, target, view) {
    const local = room.players.find(player => player.id === localPlayerId), zoomLabel = camera.viewUnits.toFixed(camera.viewUnits % 1 < .03 ? 0 : 1), modeLabel = room.mode === 'survival' ? 'SURVIVAL' : 'TEAM', locked = controlsLocked(), viewMode = locked ? 'CAMERA LOCKED' : camera.manual ? 'FREE CAMERA' : 'FOLLOW CAMERA';
    ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(7,10,18,.84)'; ctx.fillRect(24, 24, 590, 126); ctx.strokeStyle = 'rgba(155,184,255,.25)'; ctx.strokeRect(24, 24, 590, 126); ctx.fillStyle = '#8cb4ff'; ctx.font = '700 13px ui-monospace,monospace'; ctx.fillText(`PHASE 3 // ${modeLabel} // ${viewMode}`, 42, 50); ctx.fillStyle = '#e7edff'; ctx.font = '700 14px ui-monospace,monospace'; ctx.fillText(`OBSERVING: ${target?.name ?? '—'}${target?.id === localPlayerId ? ' (YOU)' : ''}`, 42, 76); ctx.fillStyle = '#8995b8'; ctx.font = '12px ui-monospace,monospace'; ctx.fillText(`view ${zoomLabel}x${zoomLabel} of world 5x5 // center ${Math.round(camera.centerX)}, ${Math.round(camera.centerY)}`, 42, 100); ctx.fillText(locked ? 'camera controls unlock after the automatic turn transition' : 'drag = pan // wheel = zoom 1x1..5x5 // double click = follow active', 42, 122); ctx.fillText(`you: ${local?.name ?? '—'} // visible players: ${visiblePlayerCount(room, view)}/${room.players.length}`, 42, 142);
  }

  function drawTurnHud(room) {
    if (room.status !== 'started' || !room.match?.activePlayerId) return;
    const active = room.players.find(player => player.id === room.match.activePlayerId), next = nextPlayer(room), remainingMs = Math.max(0, (room.match.turnEndsAt ?? Date.now()) - Date.now()), remaining = (remainingMs / 1000).toFixed(1), wind = room.match.wind, arrow = wind?.direction === 'left' ? '←' : wind?.direction === 'right' ? '→' : '·', localTurn = room.match.activePlayerId === localPlayerId, x = canvas.width - 414;
    ctx.textAlign = 'left'; ctx.fillStyle = localTurn ? 'rgba(30,42,22,.90)' : 'rgba(7,10,18,.88)'; ctx.fillRect(x, 24, 390, 150); ctx.strokeStyle = localTurn ? 'rgba(166,255,135,.55)' : 'rgba(255,232,154,.35)'; ctx.strokeRect(x, 24, 390, 150); ctx.fillStyle = localTurn ? '#a6ff87' : '#ffe89a'; ctx.font = '800 16px ui-monospace,monospace'; ctx.fillText(localTurn ? 'YOUR TURN' : 'SPECTATING', x + 18, 50); ctx.fillStyle = '#e7edff'; ctx.font = '700 14px ui-monospace,monospace'; ctx.fillText(`TURN ${room.match.turnNumber ?? 1} // ACTIVE: ${active?.name ?? '—'}`, x + 18, 78); ctx.fillStyle = '#8cb4ff'; ctx.font = '800 22px ui-monospace,monospace'; ctx.fillText(`TIME ${remaining}s`, x + 18, 108); ctx.fillStyle = '#e7edff'; ctx.font = '700 14px ui-monospace,monospace'; ctx.fillText(`WIND ${arrow} ${wind?.strength ?? 0}`, x + 190, 108); ctx.fillStyle = '#8995b8'; ctx.font = '12px ui-monospace,monospace'; ctx.fillText(`NEXT: ${next?.name ?? '—'} // timer controlled by server`, x + 18, 136); ctx.fillText(localTurn ? 'Controls for aiming/shooting arrive in Phase 4.' : 'Camera follows each new active player, then unlocks.', x + 18, 158);
  }

  function drawWorld(room) {
    const arena = room.arena, view = currentView(arena), target = cameraTarget(room); ctx.clearRect(0, 0, canvas.width, canvas.height); drawBackground(); ctx.fillStyle = '#18243d'; ctx.beginPath(); for (let sx = 0; sx <= canvas.width; sx += 12) { const wx = view.x + (sx / canvas.width) * view.width, sy = worldToScreen(wx, terrainY(wx), view).y; if (sx === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy); } ctx.lineTo(canvas.width, canvas.height); ctx.lineTo(0, canvas.height); ctx.fill();
    for (const player of room.players) { if (!player.spawn) continue; const screen = worldToScreen(player.spawn.x, player.spawn.y, view); if (screen.x < -80 || screen.x > canvas.width + 80 || screen.y < -80 || screen.y > canvas.height + 80) continue; drawVehicle(room, player, screen, view, player.id === localPlayerId, player.id === room.match?.activePlayerId); }
    drawCameraHud(room, target, view); drawTurnHud(room);
  }

  function countdownLabel(room) { const elapsed = Date.now() - (room.match?.countdownStartedAt ?? Date.now()); if (elapsed < 1000) return 'GET READY'; const n = 6 - Math.floor(elapsed / 1000); return n > 0 ? String(n) : 'START'; }
  function drawCountdownOverlay(room) { ctx.fillStyle = 'rgba(2,4,10,.44)'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.textAlign = 'center'; ctx.fillStyle = '#e7edff'; ctx.font = '800 76px system-ui,sans-serif'; ctx.fillText(countdownLabel(room), canvas.width / 2, canvas.height / 2); ctx.font = '700 18px ui-monospace,monospace'; ctx.fillStyle = '#8cb4ff'; ctx.fillText(room.mode === 'survival' ? 'SURVIVAL MODE // FULL MAP OVERVIEW' : 'TEAM MODE // FULL MAP OVERVIEW', canvas.width / 2, canvas.height / 2 + 54); ctx.font = '12px ui-monospace,monospace'; ctx.fillStyle = '#8995b8'; ctx.fillText('Server will start Turn 1 and dive to the opening player', canvas.width / 2, canvas.height / 2 + 82); }
  function frame(now) { if (!activeRoom?.arena) return; ensureCameraState(activeRoom); updateCamera(activeRoom, now); drawWorld(activeRoom); if (activeRoom.status === 'countdown') drawCountdownOverlay(activeRoom); animationFrame = requestAnimationFrame(frame); }
  function drawArena(room, nextLocalPlayerId = null) { localPlayerId = nextLocalPlayerId; activeRoom = room; if (!room?.arena || !['countdown', 'started'].includes(room.status)) { drawScaffold(); return; } ensureCameraState(room); if (!animationFrame) animationFrame = requestAnimationFrame(frame); }
  function pointerPosition(event) { const rect = canvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) / rect.width * canvas.width, y: (event.clientY - rect.top) / rect.height * canvas.height }; }

  canvas.addEventListener('pointerdown', event => { if (!activeRoom?.arena || controlsLocked()) return; dragging = true; canvas.setPointerCapture?.(event.pointerId); const p = pointerPosition(event); dragStart = { ...p, centerX: camera.centerX, centerY: camera.centerY }; camera.manual = true; });
  canvas.addEventListener('pointermove', event => { if (!dragging || !dragStart || !activeRoom?.arena || controlsLocked()) return; const p = pointerPosition(event), size = viewSize(activeRoom.arena); camera.targetCenterX = dragStart.centerX - (p.x - dragStart.x) / canvas.width * size.width; camera.targetCenterY = dragStart.centerY - (p.y - dragStart.y) / canvas.height * size.height; camera.centerX = camera.targetCenterX; camera.centerY = camera.targetCenterY; clampCamera(activeRoom.arena); });
  function stopDragging(event) { dragging = false; dragStart = null; if (event?.pointerId != null) canvas.releasePointerCapture?.(event.pointerId); }
  canvas.addEventListener('pointerup', stopDragging); canvas.addEventListener('pointercancel', stopDragging); canvas.addEventListener('pointerleave', event => { if (dragging && event.buttons === 0) stopDragging(event); });
  canvas.addEventListener('wheel', event => { if (!activeRoom?.arena || controlsLocked()) return; event.preventDefault(); const arena = activeRoom.arena, p = pointerPosition(event), before = screenToWorld(p.x, p.y, arena), direction = event.deltaY > 0 ? 1 : -1, nextUnits = clamp(camera.viewUnits + direction * .35, MIN_VIEW_UNITS, MAX_VIEW_UNITS); if (Math.abs(nextUnits - camera.viewUnits) < .001) return; camera.manual = true; camera.viewUnits = nextUnits; camera.targetViewUnits = nextUnits; const newSize = viewSize(arena, nextUnits); camera.centerX = before.x - (p.x / canvas.width - .5) * newSize.width; camera.centerY = before.y - (p.y / canvas.height - .5) * newSize.height; camera.targetCenterX = camera.centerX; camera.targetCenterY = camera.centerY; clampCamera(arena); }, { passive: false });
  canvas.addEventListener('dblclick', () => { if (!activeRoom?.arena || controlsLocked()) return; camera.manual = false; camera.targetViewUnits = MIN_VIEW_UNITS; setFollowTarget(activeRoom, false); });

  return Object.freeze({ drawScaffold, drawArena });
}
