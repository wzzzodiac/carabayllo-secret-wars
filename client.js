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
    room_action_rate_limited: 'Too many room requests. Wait a moment and try again.',
    already_in_room: 'This tab is already inside a room.',
    request_timeout: 'The server did not answer in time. Try again.'
  };
  return messages[code] || `Server rejected the request: ${code || 'unknown_error'}`;
}

async function ensureConnection() {
  ui.setBusy(true);
  ui.setServerStatus('CONNECTING');
  ui.setMessage('Waking the multiplayer server...');
  try {
    activeSocket = await socketBoundary.connect();
    ui.setServerStatus('CONNECTED');
    activeSocket.off('room_state');
    activeSocket.on('room_state', room => ui.renderRoom(room));
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

function request(eventName, payload) {
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
    ui.renderRoom(result.room);
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
    ui.renderRoom(result.room);
    ui.setMessage(`Joined room ${result.room.code}.`);
  } finally {
    ui.setBusy(false);
  }
}

ui.createRoomButton.addEventListener('click', createRoom);
ui.joinRoomButton.addEventListener('click', joinRoom);
ui.roomCode.addEventListener('input', () => {
  ui.roomCode.value = ui.roomCode.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
});

window.addEventListener('pagehide', () => socketBoundary.disconnect());

console.info('Orbital Artillery Phase 1 client ready.', {
  maxPlayers: CLIENT_CONFIG.maxPlayers,
  serverConfigured: socketBoundary.isConfigured,
  playerId
});
