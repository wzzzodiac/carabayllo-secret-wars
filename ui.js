export function createUI() {
  const clientStatus = document.getElementById('clientStatus');
  const serverStatus = document.getElementById('serverStatus');
  const playerName = document.getElementById('playerName');
  const roomCode = document.getElementById('roomCode');
  const createRoomButton = document.getElementById('createRoom');
  const joinRoomButton = document.getElementById('joinRoom');
  const actionMessage = document.getElementById('actionMessage');
  const activeRoomCode = document.getElementById('activeRoomCode');
  const roomCount = document.getElementById('roomCount');
  const playerList = document.getElementById('playerList');

  function setBusy(busy) {
    createRoomButton.disabled = busy;
    joinRoomButton.disabled = busy;
  }

  function renderRoom(room) {
    activeRoomCode.textContent = room?.code ?? '----';
    roomCount.textContent = `${room?.players?.length ?? 0} / ${room?.maxPlayers ?? 8}`;

    if (!room?.players?.length) {
      playerList.innerHTML = '<div class="empty-room">No room joined yet.</div>';
      return;
    }

    playerList.innerHTML = room.players.map((player, index) => `
      <div class="player-row">
        <span class="player-index">${String(index + 1).padStart(2, '0')}</span>
        <strong>${escapeHtml(player.name)}</strong>
        <span class="player-team">TEAM ${escapeHtml(player.team)}</span>
        <span class="player-host">${player.isHost ? 'HOST' : ''}</span>
      </div>
    `).join('');
  }

  return Object.freeze({
    playerName,
    roomCode,
    createRoomButton,
    joinRoomButton,
    setClientStatus(value) { clientStatus.textContent = value; },
    setServerStatus(value) { serverStatus.textContent = value; },
    setMessage(value) { actionMessage.textContent = value; },
    setBusy,
    renderRoom
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
