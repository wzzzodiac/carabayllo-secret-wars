import { CLIENT_CONFIG } from './config.js';
import { createSocketBoundary } from './socket.js';
import { createRenderer } from './renderer.js';
import { createUI } from './ui.js';

const canvas = document.getElementById('gameCanvas');
const ui = createUI();
const renderer = createRenderer(canvas, CLIENT_CONFIG);
const socketBoundary = createSocketBoundary();

let activeSocket = null;
let playerId = null;
let currentRoom = null;
let disconnectHandlerBound = false;

renderer.drawScaffold();
ui.setClientStatus('READY');
ui.setServerStatus(socketBoundary.isConfigured ? 'OFFLINE / ON DEMAND' : 'NOT CONFIGURED');
ui.playerName.value = localStorage.getItem('orbital-artillery-player-name') || '';

function normalizeName() {
  const name = ui.playerName.value.trim().slice(0, 20);
  if (name) localStorage.setItem('orbital-artillery-player-name', name);
  return name;
}

function humanError(code) {
  const messages = {
    invalid_name: 'Enter a player name first.',
    invalid_room_code: 'Room code must contain 4 valid characters.',
    room_not_found: 'That room does not exist.',
    room_full: 'That room already has 8 players.',
    room_already_started: 'That room has already started.',
    server_room_capacity: 'The server has reached its temporary room limit.',
    room_action_rate_limited: 'Too many lobby requests. Wait a moment and try again.',
    already_in_room: 'This tab is already inside a room.',
    not_in_room: 'This tab is not currently inside a room.',
    invalid_team: 'That team selection is invalid.',
    team_full: 'That team already has 4 players.',
    host_only: 'Only the host can start the match.',
    not_enough_players: 'At least 2 players are required to start.',
    players_not_ready: 'Every player must be READY before starting.',
    both_teams_required: 'Both Team A and Team B need at least one player.',
    request_timeout: 'The server did not answer in time. Try again.'
  };
  return messages[code] || `Server rejected the request: ${code || 'unknown_error'}`;
}

function renderRoom(room) {
  currentRoom = room;
  ui.renderRoom(room, playerId);
  renderer.drawArena(room, playerId);
}

async function ensureConnection() {
  ui.setBusy(true);
  ui.setServerStatus('CONNECTING');
  ui.setMessage('Waking the multiplayer server...');
  try {
    activeSocket = await socketBoundary.connect();
    ui.setServerStatus('CONNECTED');
    activeSocket.off('room_state');
    activeSocket.on('room_state', renderRoom);
    if (!disconnectHandlerBound) {
      activeSocket.on('disconnect', () => {
        disconnectHandlerBound = false;
        ui.setServerStatus('OFFLINE');
        ui.setMessage('Connection closed. Create or join again to reconnect.');
      });
      disconnectHandlerBound = true;
    }
    return activeSocket;
  } catch (error) {
    ui.setServerStatus('ERROR');
    ui.setMessage(`Could not connect to the server: ${error?.message || 'connection failed'}`);
    throw error;
  } finally {
    ui.setBusy(false);
  }
}

function request(eventName, payload = {}) {
  return new Promise(resolve => {
    activeSocket.timeout(8_000).emit(eventName, payload, (error, response) => {
      if (error) return resolve({ ok: false, error: 'request_timeout' });
      resolve(response || { ok: false, error: 'empty_response' });
    });
  });
}

async function createRoom() {
  const name = normalizeName();
  if (!name) return ui.setMessage('Enter a player name first.');

  try {
    await ensureConnection();
    ui.setBusy(true);
    const result = await request('create_room', { name });
    if (!result.ok) return ui.setMessage(humanError(result.error));
    playerId = result.playerId;
    renderRoom(result.room);
    ui.setMessage(`Room ${result.room.code} created. Share this code with up to 7 friends.`);
  } finally {
    ui.setBusy(false);
  }
}

async function joinRoom() {
  const name = normalizeName();
  const code = ui.roomCode.value.trim().toUpperCase();
  ui.roomCode.value = code;
  if (!name) return ui.setMessage('Enter a player name first.');
  if (code.length !== 4) return ui.setMessage('Enter the 4-character room code.');

  try {
    await ensureConnection();
    ui.setBusy(true);
    const result = await request('join_room', { name, code });
    if (!result.ok) return ui.setMessage(humanError(result.error));
    playerId = result.playerId;
    renderRoom(result.room);
    ui.setMessage(`Joined room ${result.room.code}.`);
  } finally {
    ui.setBusy(false);
  }
}

async function setReady() {
  const me = currentRoom?.players?.find(player => player.id === playerId);
  if (!me || !activeSocket) return;
  const targetReady = !me.ready;
  const result = await request('set_ready', { ready: targetReady });
  if (!result.ok) return ui.setMessage(humanError(result.error));
  renderRoom(result.room);
  ui.setMessage(targetReady ? 'You are READY.' : 'Ready status cancelled.');
}

async function setTeam(team) {
  const me = currentRoom?.players?.find(player => player.id === playerId);
  if (!me || me.team === team || !activeSocket) return;
  const result = await request('set_team', { team });
  if (!result.ok) return ui.setMessage(humanError(result.error));
  renderRoom(result.room);
  ui.setMessage(`Moved to Team ${team}. Ready status was reset.`);
}

async function startGame() {
  if (!activeSocket) return;
  const result = await request('start_game');
  if (!result.ok) return ui.setMessage(humanError(result.error));
  renderRoom(result.room);
  ui.setMessage('Arena initialized. Compare this viewport with the other connected clients.');
}

ui.createRoomButton.addEventListener('click', createRoom);
ui.joinRoomButton.addEventListener('click', joinRoom);
ui.readyButton.addEventListener('click', setReady);
ui.teamAButton.addEventListener('click', () => setTeam('A'));
ui.teamBButton.addEventListener('click', () => setTeam('B'));
ui.startGameButton.addEventListener('click', startGame);
ui.roomCode.addEventListener('input', () => {
  ui.roomCode.value = ui.roomCode.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
});

window.addEventListener('pagehide', () => socketBoundary.disconnect());

console.info('Orbital Artillery Phase 2 arena sync ready.', {
  maxPlayers: CLIENT_CONFIG.maxPlayers,
  serverConfigured: socketBoundary.isConfigured,
  playerId
});
