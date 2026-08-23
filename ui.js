export function createUI() {
  const q = id => document.getElementById(id);
  const clientStatus = q('clientStatus');
  const serverStatus = q('serverStatus');
  const playerName = q('playerName');
  const roomCode = q('roomCode');
  const createRoomButton = q('createRoom');
  const joinRoomButton = q('joinRoom');
  const actionMessage = q('actionMessage');
  const activeRoomCode = q('activeRoomCode');
  const roomCount = q('roomCount');
  const roomStatus = q('roomStatus');
  const playerList = q('playerList');
  const roomControls = q('roomControls');
  const readyButton = q('readyButton');
  const teamAButton = q('teamAButton');
  const teamBButton = q('teamBButton');
  const startGameButton = q('startGameButton');
  const lobbyHint = q('lobbyHint');
  const teamControls = q('teamControls');
  const modeControls = q('modeControls');
  const teamModeButton = q('teamModeButton');
  const survivalModeButton = q('survivalModeButton');
  const arenaTitle = q('arenaTitle');
  const arenaOverlay = arenaTitle.closest('.overlay');

  function setBusy(busy) {
    createRoomButton.disabled = busy;
    joinRoomButton.disabled = busy;
  }

  function renderRoom(room, playerId) {
    activeRoomCode.textContent = room?.code ?? '----';
    roomCount.textContent = `${room?.players?.length ?? 0} / ${room?.maxPlayers ?? 8}`;
    roomStatus.textContent = room?.status === 'countdown' ? 'COUNTDOWN' : room?.status === 'started' ? 'TURN ACTIVE' : 'LOBBY';

    if (!room?.players?.length) {
      playerList.innerHTML = '<div class="empty-room">No room joined yet.</div>';
      roomControls.hidden = true;
      arenaOverlay.hidden = false;
      return;
    }

    arenaOverlay.hidden = true;
    playerList.innerHTML = room.players.map((player, index) => `
      <div class="player-row${player.id === playerId ? ' current-player' : ''}">
        <span class="player-index">${String(index + 1).padStart(2, '0')}</span>
        <strong>${esc(player.name)}</strong>
        <span class="player-team">${room.mode === 'survival' ? 'SURVIVAL' : `TEAM ${esc(player.team)}`}</span>
        <span class="player-ready ${player.ready ? 'is-ready' : ''}">${player.ready ? 'READY' : 'NOT READY'}</span>
        <span class="player-host">${player.isHost ? 'HOST' : ''}</span>
      </div>`).join('');

    const me = room.players.find(player => player.id === playerId);
    roomControls.hidden = !me;
    if (!me) return;

    const locked = room.status !== 'lobby';
    readyButton.disabled = locked;
    teamControls.hidden = room.mode !== 'team';
    teamAButton.disabled = locked || me.team === 'A';
    teamBButton.disabled = locked || me.team === 'B';
    readyButton.textContent = me.ready ? 'CANCEL READY' : 'READY';
    readyButton.classList.toggle('active', me.ready);
    teamAButton.classList.toggle('active', me.team === 'A');
    teamBButton.classList.toggle('active', me.team === 'B');
    modeControls.hidden = !me.isHost;
    teamModeButton.disabled = locked;
    survivalModeButton.disabled = locked;
    teamModeButton.classList.toggle('active', room.mode === 'team');
    survivalModeButton.classList.toggle('active', room.mode === 'survival');
    startGameButton.hidden = !me.isHost;
    startGameButton.disabled = locked;

    if (room.status === 'countdown') {
      lobbyHint.textContent = 'Full-map countdown active. Turn 1 begins automatically.';
    } else if (room.status === 'started') {
      const active = room.players.find(player => player.id === room.match?.activePlayerId);
      lobbyHint.textContent = `Turn ${room.match?.turnNumber ?? 1}: ${active?.name ?? 'player'} is active.`;
    } else {
      const terrainName = room.terrainPresets?.find(entry => entry.id === room.terrainPreset)?.name ?? room.terrainPreset;
      lobbyHint.textContent = me.isHost
        ? `Host: choose mode and terrain. The arena below previews ${terrainName} live before START.`
        : `Terrain preview: ${terrainName}. Mark yourself READY when the setup looks good.`;
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
    teamModeButton,
    survivalModeButton,
    startGameButton,
    setClientStatus: value => { clientStatus.textContent = value; },
    setServerStatus: value => { serverStatus.textContent = value; },
    setMessage: value => { actionMessage.textContent = value; },
    setBusy,
    renderRoom
  });
}

function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
