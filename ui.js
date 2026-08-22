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
  const roomStatus = document.getElementById('roomStatus');
  const playerList = document.getElementById('playerList');
  const roomControls = document.getElementById('roomControls');
  const readyButton = document.getElementById('readyButton');
  const teamAButton = document.getElementById('teamAButton');
  const teamBButton = document.getElementById('teamBButton');
  const startGameButton = document.getElementById('startGameButton');
  const lobbyHint = document.getElementById('lobbyHint');
  const arenaTitle = document.getElementById('arenaTitle');
  const arenaSubtitle = document.getElementById('arenaSubtitle');
  const arenaOverlay = arenaTitle.closest('.overlay');

  function setBusy(busy) {
    createRoomButton.disabled = busy;
    joinRoomButton.disabled = busy;
  }

  function renderRoom(room, playerId) {
    activeRoomCode.textContent = room?.code ?? '----';
    roomCount.textContent = `${room?.players?.length ?? 0} / ${room?.maxPlayers ?? 8}`;
    roomStatus.textContent = room?.status === 'started' ? 'ARENA ACTIVE' : 'LOBBY';

    if (!room?.players?.length) {
      playerList.innerHTML = '<div class="empty-room">No room joined yet.</div>';
      roomControls.hidden = true;
      arenaOverlay.hidden = false;
      return;
    }

    playerList.innerHTML = room.players.map((player, index) => `
      <div class="player-row${player.id === playerId ? ' current-player' : ''}">
        <span class="player-index">${String(index + 1).padStart(2, '0')}</span>
        <strong>${escapeHtml(player.name)}</strong>
        <span class="player-team">TEAM ${escapeHtml(player.team)}</span>
        <span class="player-ready ${player.ready ? 'is-ready' : ''}">${player.ready ? 'READY' : 'NOT READY'}</span>
        <span class="player-host">${player.isHost ? 'HOST' : ''}</span>
      </div>
    `).join('');

    const me = room.players.find(player => player.id === playerId);
    roomControls.hidden = !me;
    if (!me) return;

    const locked = room.status !== 'lobby';
    readyButton.disabled = locked;
    teamAButton.disabled = locked || me.team === 'A';
    teamBButton.disabled = locked || me.team === 'B';
    readyButton.textContent = me.ready ? 'CANCEL READY' : 'READY';
    readyButton.classList.toggle('active', me.ready);
    teamAButton.classList.toggle('active', me.team === 'A');
    teamBButton.classList.toggle('active', me.team === 'B');

    startGameButton.hidden = !me.isHost;
    startGameButton.disabled = locked;

    if (locked) {
      lobbyHint.textContent = 'Arena synchronized. Phase 2 verifies identical spawn state on every client.';
      arenaTitle.textContent = 'SYNCHRONIZED ARENA';
      arenaSubtitle.textContent = 'Server-assigned positions are now rendered below';
      arenaOverlay.hidden = true;
    } else if (me.isHost) {
      lobbyHint.textContent = 'Host: wait until everyone is READY, then start the match.';
      arenaTitle.textContent = 'ARENA STANDBY';
      arenaSubtitle.textContent = 'Start the match to receive server-assigned spawn positions';
      arenaOverlay.hidden = false;
    } else {
      lobbyHint.textContent = 'Choose a team and mark yourself ready.';
      arenaTitle.textContent = 'ARENA STANDBY';
      arenaSubtitle.textContent = 'Waiting for the host to start the match';
      arenaOverlay.hidden = false;
    }
  }

  return Object.freeze({
    playerName,
    roomCode,
    createRoomButton,
    joinRoomButton,
    readyButton,
    teamAButton,
    teamBButton,
    startGameButton,
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
