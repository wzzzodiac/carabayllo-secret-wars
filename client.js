import { CLIENT_CONFIG } from './config.js';
import { createSocketBoundary } from './socket.js';
import { createRenderer } from './renderer.js?v=phase4-controls-3';
import { createUI } from './ui.js?v=phase3-turns-1';
import { initWindGusts } from './wind-gusts.js?v=phase3-wind-1';
import { initCombatControls } from './combat-controls.js?v=phase4-controls-3';

const canvas = document.getElementById('gameCanvas');
const ui = createUI();
const renderer = createRenderer(canvas, CLIENT_CONFIG);
const windGusts = initWindGusts(canvas);
const combatControls = initCombatControls(canvas);
const socketBoundary = createSocketBoundary();
let activeSocket = null;
let playerId = null;
let currentRoom = null;
let disconnectHandlerBound = false;
let heldMoveDirection = 0;
let moveTimer = null;
let moveInFlight = false;
let pendingAngleDelta = 0;
let pendingPowerDelta = 0;
let aimPumpPromise = null;
const lastAuthoritativeSpawns = new Map();
const MOVE_INTERVAL_MS = 135;
const MOVE_VISUAL_MS = 150;

renderer.drawScaffold();
ui.setClientStatus('READY');
ui.setServerStatus(socketBoundary.isConfigured ? 'OFFLINE / ON DEMAND' : 'NOT CONFIGURED');
ui.playerName.value = localStorage.getItem('orbital-artillery-player-name') || '';

const humanError = code => ({
  invalid_name: 'Enter a player name first.',
  invalid_room_code: 'Room code must contain 4 valid characters.',
  room_not_found: 'That room does not exist.',
  room_full: 'That room already has 8 players.',
  room_already_started: 'That room has already started.',
  server_room_capacity: 'The server has reached its temporary room limit.',
  room_action_rate_limited: 'Too many lobby requests. Wait a moment.',
  already_in_room: 'This tab is already inside a room.',
  not_in_room: 'This tab is not currently inside a room.',
  invalid_team: 'That team selection is invalid.',
  team_full: 'That team already has 4 players.',
  teams_disabled: 'Teams are disabled in Survival mode.',
  invalid_mode: 'That game mode is invalid.',
  host_only: 'Only the host can do that.',
  not_enough_players: 'At least 2 players are required.',
  players_not_ready: 'Every player must be READY.',
  both_teams_required: 'Both teams need at least one player.',
  request_timeout: 'The server did not answer in time.',
  match_not_started: 'The match is not active yet.',
  not_your_turn: 'Wait for your turn.',
  shot_in_flight: 'Your shot is already in flight.',
  player_in_motion: 'Wait until the jump finishes.',
  invalid_direction: 'Invalid movement direction.',
  movement_limit: 'You reached this turn\'s movement radius.',
  no_jumps_remaining: 'No jumps remaining this turn.'
}[code] || `Server rejected the request: ${code || 'unknown_error'}`);

function makeDisplayRoom(room) {
  const now = Date.now();
  const displayRoom = {
    ...room,
    match: room.match ? { ...room.match, movementOriginX: null } : null,
    camera: room.camera ? { ...room.camera } : null,
    arena: room.arena ? { ...room.arena } : null,
    players: room.players.map(player => {
      const next = {
        ...player,
        spawn: player.spawn ? { ...player.spawn } : null,
        motion: player.motion ? { ...player.motion } : null
      };
      const previous = lastAuthoritativeSpawns.get(player.id);
      if (next.spawn && previous && !next.motion) {
        const moved = Math.abs(next.spawn.x - previous.x) > 0.01 || Math.abs(next.spawn.y - previous.y) > 0.01;
        if (moved) {
          next.motion = {
            type: 'jump',
            startedAt: now,
            endsAt: now + MOVE_VISUAL_MS,
            fromX: previous.x,
            fromY: previous.y,
            toX: next.spawn.x,
            toY: next.spawn.y,
            apex: 0
          };
        }
      }
      if (next.spawn) lastAuthoritativeSpawns.set(player.id, { ...next.spawn });
      return next;
    })
  };
  return displayRoom;
}

function stopHeldMove() {
  heldMoveDirection = 0;
  if (moveTimer) clearInterval(moveTimer);
  moveTimer = null;
}

function clearPendingAim() {
  pendingAngleDelta = 0;
  pendingPowerDelta = 0;
}

function renderRoom(room) {
  currentRoom = room;
  if (room?.status === 'started' && ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) document.activeElement.blur();
  if (room?.match?.activePlayerId !== playerId || room?.match?.projectile) {
    stopHeldMove();
    clearPendingAim();
  }
  ui.renderRoom(room, playerId);
  renderer.drawArena(makeDisplayRoom(room), playerId);
  windGusts.update(room);
  combatControls.update(room, playerId);
}

async function ensureConnection() {
  ui.setBusy(true);
  ui.setServerStatus('CONNECTING');
  try {
    activeSocket = await socketBoundary.connect();
    ui.setServerStatus('CONNECTED');
    activeSocket.off('room_state');
    activeSocket.on('room_state', renderRoom);
    if (!disconnectHandlerBound) {
      activeSocket.on('disconnect', () => {
        disconnectHandlerBound = false;
        stopHeldMove();
        clearPendingAim();
        ui.setServerStatus('OFFLINE');
        ui.setMessage('Connection closed. Create or join again.');
      });
      disconnectHandlerBound = true;
    }
    return activeSocket;
  } finally {
    ui.setBusy(false);
  }
}

function request(event, payload = {}) {
  return new Promise(resolve => activeSocket.timeout(8000).emit(event, payload, (err, result) => resolve(err ? { ok: false, error: 'request_timeout' } : result || { ok: false, error: 'empty_response' })));
}

function name() {
  const value = ui.playerName.value.trim().slice(0, 20);
  if (value) localStorage.setItem('orbital-artillery-player-name', value);
  return value;
}

async function createRoom() {
  const value = name();
  if (!value) return ui.setMessage('Enter a player name first.');
  await ensureConnection();
  const result = await request('create_room', { name: value });
  if (!result.ok) return ui.setMessage(humanError(result.error));
  playerId = result.playerId;
  renderRoom(result.room);
  ui.setMessage(`Room ${result.room.code} created.`);
}

async function joinRoom() {
  const value = name();
  const code = ui.roomCode.value.trim().toUpperCase();
  ui.roomCode.value = code;
  if (!value) return ui.setMessage('Enter a player name first.');
  if (code.length !== 4) return ui.setMessage('Enter the 4-character room code.');
  await ensureConnection();
  const result = await request('join_room', { name: value, code });
  if (!result.ok) return ui.setMessage(humanError(result.error));
  playerId = result.playerId;
  renderRoom(result.room);
  ui.setMessage(`Joined room ${result.room.code}.`);
}

async function mutate(event, payload, message) {
  if (!activeSocket) return null;
  const result = await request(event, payload);
  if (!result.ok) {
    ui.setMessage(humanError(result.error));
    return result;
  }
  renderRoom(result.room);
  if (message) ui.setMessage(message);
  return result;
}

ui.createRoomButton.addEventListener('click', createRoom);
ui.joinRoomButton.addEventListener('click', joinRoom);
ui.readyButton.addEventListener('click', () => {
  const me = currentRoom?.players.find(player => player.id === playerId);
  if (me) mutate('set_ready', { ready: !me.ready }, !me.ready ? 'You are READY.' : 'Ready cancelled.');
});
ui.teamAButton.addEventListener('click', () => mutate('set_team', { team: 'A' }, 'Moved to Team A.'));
ui.teamBButton.addEventListener('click', () => mutate('set_team', { team: 'B' }, 'Moved to Team B.'));
ui.teamModeButton.addEventListener('click', () => mutate('set_mode', { mode: 'team' }, 'Team mode selected. READY states reset.'));
ui.survivalModeButton.addEventListener('click', () => mutate('set_mode', { mode: 'survival' }, 'Survival mode selected. READY states reset.'));
ui.startGameButton.addEventListener('click', () => mutate('start_game', {}, 'Match countdown started.'));
ui.roomCode.addEventListener('input', () => { ui.roomCode.value = ui.roomCode.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4); });

function isMyActionTurn() {
  return currentRoom?.status === 'started'
    && currentRoom.match?.activePlayerId === playerId
    && !currentRoom.match?.projectile;
}

async function sendMoveStep() {
  if (!heldMoveDirection || !isMyActionTurn() || moveInFlight || !activeSocket) return;
  moveInFlight = true;
  try {
    const result = await request('move_player', { direction: heldMoveDirection });
    if (!result.ok) {
      if (result.error === 'movement_limit' || result.error === 'not_your_turn' || result.error === 'shot_in_flight') stopHeldMove();
      if (result.error !== 'movement_limit') ui.setMessage(humanError(result.error));
      return;
    }
    renderRoom(result.room);
  } finally {
    moveInFlight = false;
  }
}

function startHeldMove(direction) {
  heldMoveDirection = direction;
  if (!moveTimer) {
    sendMoveStep();
    moveTimer = setInterval(sendMoveStep, MOVE_INTERVAL_MS);
  }
}

function queueAim(angleDelta = 0, powerDelta = 0) {
  if (!isMyActionTurn()) return;
  pendingAngleDelta += angleDelta;
  pendingPowerDelta += powerDelta;
  if (aimPumpPromise) return;

  aimPumpPromise = (async () => {
    while (isMyActionTurn() && (pendingAngleDelta || pendingPowerDelta)) {
      const angleStep = pendingAngleDelta;
      const powerStep = pendingPowerDelta;
      pendingAngleDelta = 0;
      pendingPowerDelta = 0;
      const payload = {};
      if (angleStep) payload.angle = (currentRoom.match?.aimAngle ?? 45) + angleStep;
      if (powerStep) payload.power = (currentRoom.match?.aimPower ?? 55) + powerStep;
      const result = await request('set_aim', payload);
      if (!result.ok) {
        clearPendingAim();
        ui.setMessage(humanError(result.error));
        break;
      }
      renderRoom(result.room);
    }
  })().finally(() => { aimPumpPromise = null; });
}

async function fireShot() {
  stopHeldMove();
  if (aimPumpPromise) await aimPumpPromise;
  if (!isMyActionTurn()) return;
  await mutate('fire_projectile', {}, 'Shot fired.');
}

window.addEventListener('keydown', event => {
  if (!isMyActionTurn()) return;

  const code = event.code;
  if (['KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyQ', 'KeyE', 'KeyF', 'Space'].includes(code)) event.preventDefault();

  if (code === 'KeyA' || code === 'KeyD') {
    if (!event.repeat) startHeldMove(code === 'KeyA' ? -1 : 1);
    return;
  }

  if (code === 'Space' && !event.repeat) {
    stopHeldMove();
    const me = currentRoom.players.find(player => player.id === playerId);
    mutate('jump_player', { direction: me?.spawn?.facing || 1 });
    return;
  }

  if (code === 'KeyW' || code === 'KeyS') {
    stopHeldMove();
    queueAim(code === 'KeyW' ? 3 : -3, 0);
    return;
  }

  if (code === 'KeyQ' || code === 'KeyE') {
    stopHeldMove();
    queueAim(0, code === 'KeyE' ? 5 : -5);
    return;
  }

  if (code === 'KeyF' && !event.repeat) fireShot();
});

window.addEventListener('keyup', event => {
  if ((event.code === 'KeyA' && heldMoveDirection < 0) || (event.code === 'KeyD' && heldMoveDirection > 0)) stopHeldMove();
});

window.addEventListener('blur', stopHeldMove);
window.addEventListener('pagehide', () => {
  stopHeldMove();
  clearPendingAim();
  combatControls.destroy();
  windGusts.destroy();
  socketBoundary.disconnect();
});

console.info('Orbital Artillery Phase 4 hardened keyboard combat controls ready.');
