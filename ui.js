import {drawAppearancePreview} from './mini-avatar.js?v=somber-v1-20261025';

export function createUI() {
  const q = id => document.getElementById(id);
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
  const battle = q('battle');
  const matchNotice = q('matchNotice');
  const matchNoticeText = q('matchNoticeText');
  const playMatch = q('playMatch');
  const partyActions = q('partyActions'), returnToLobbyButton = q('returnToLobby'), leavePartyButton = q('leaveParty');

  function setBusy(busy) { createRoomButton.disabled = busy; joinRoomButton.disabled = busy; }

  function renderRoom(room, playerId) {
    const hasPlayers = Boolean(room?.players?.length);
    const combatStarted = hasPlayers && ['countdown', 'started', 'finished'].includes(room.status);
    const member = room?.players?.find(player => player.id === playerId);
    partyActions.hidden = !member;
    returnToLobbyButton.hidden = !combatStarted;
    returnToLobbyButton.disabled = !member?.isHost;
    returnToLobbyButton.title = member?.isHost ? 'Return everyone to the lobby' : 'Host only';
    document.body.dataset.phase = combatStarted ? 'battle' : hasPlayers ? 'lobby' : 'entry';
    battle.hidden = !combatStarted;
    matchNotice.hidden = !combatStarted;
    matchNoticeText.textContent = room?.status === 'finished' ? 'Match complete' : room?.status === 'countdown' ? 'Match starting' : 'Match ready';
    playMatch.textContent = room?.status === 'finished' ? 'RESULTS ↓' : 'PLAY ↓';
    activeRoomCode.textContent = room?.code ?? '----';
    roomCount.textContent = `${room?.players?.length ?? 0} / ${room?.maxPlayers ?? 8}`;
    roomStatus.textContent = room?.status === 'countdown' ? 'STARTING' : room?.status === 'started' ? 'LIVE' : room?.status === 'finished' ? 'FINISHED' : hasPlayers ? 'LOBBY' : 'NO ROOM';

    if (!room?.players?.length) {
      playerList.innerHTML = '<div class="empty-room">Create or join a room.</div>';
      roomControls.hidden = true;
      arenaOverlay.hidden = false;
      return;
    }

    arenaOverlay.hidden = true;
    playerList.innerHTML = room.players.map((player, index) => `
      <div class="player-row${player.id === playerId ? ' current-player' : ''}">
        <canvas class="lobby-avatar" width="144" height="104" role="img" aria-label="Character ${index+1}"></canvas>
        <strong>${esc(player.name)}</strong>
        <span class="player-team">${room.mode === 'survival' ? 'SURVIVAL' : `TEAM ${esc(player.team)}`}</span>
        <span class="player-ready ${!combatStarted && player.ready ? 'is-ready' : ''}">${combatStarted ? (player.alive === false ? 'OUT' : `HP ${Math.max(0, player.hp ?? 100)}`) : (player.ready ? 'READY' : 'NOT READY')}</span>
        <span class="player-host">${player.isHost ? 'HOST' : ''}</span>
      </div>`).join('');

    playerList.querySelectorAll('.lobby-avatar').forEach((canvas,index)=>drawAppearancePreview(canvas,room.players[index].appearance));

    const me = room.players.find(player => player.id === playerId);
    roomControls.hidden = !me || combatStarted;
    if (!me) return;

    const locked = room.status !== 'lobby';
    readyButton.disabled = locked;
    teamControls.hidden = room.mode !== 'team';
    teamAButton.disabled = locked || me.team === 'A';
    teamBButton.disabled = locked || me.team === 'B';
    readyButton.textContent = me.ready ? 'UNREADY' : 'READY';
    readyButton.classList.toggle('active', me.ready);
    teamAButton.classList.toggle('active', me.team === 'A');
    teamBButton.classList.toggle('active', me.team === 'B');
    modeControls.hidden = !me.isHost;
    teamModeButton.disabled = locked;
    survivalModeButton.disabled = locked;
    teamModeButton.classList.toggle('active', room.mode === 'team');
    survivalModeButton.classList.toggle('active', room.mode === 'survival');
    startGameButton.hidden = !me.isHost;
    const readyToStart = room.players.length >= 2 && room.players.every(player => player.ready)
      && (room.mode !== 'team' || ['A', 'B'].every(team => room.players.some(player => player.team === team)));
    startGameButton.disabled = locked || !readyToStart;

    if (room.status === 'countdown') {
      lobbyHint.textContent = 'Starting…';
    } else if (room.status === 'started') {
      const active = room.players.find(player => player.id === room.match?.activePlayerId);
      lobbyHint.textContent = `Turn ${room.match?.turnNumber ?? 1} · ${active?.name ?? 'player'}`;
    } else if (room.status === 'finished') {
      const result = room.match?.result;
      lobbyHint.textContent = result?.draw ? 'Draw.' : result?.type === 'team' ? `Team ${result.winnerTeam} wins.` : `${result?.winnerName ?? 'Player'} wins.`;
    } else {
      lobbyHint.textContent = room.players.length < 2 ? 'Waiting for players.'
        : readyToStart ? (me.isHost ? 'All ready. Start when you like.' : 'Waiting for host.')
        : room.mode === 'team' && !['A', 'B'].every(team => room.players.some(player => player.team === team)) ? 'Both teams need a player.'
        : 'Ready up.';
    }
  }

  function setServerStatus(value) {
    const state = value === 'CONNECTED' ? 'connected' : value === 'CONNECTING' ? 'connecting' : value.includes('ON DEMAND') ? 'idle' : 'offline';
    serverStatus.dataset.state = state;
    serverStatus.textContent = {connected: 'Connected', connecting: 'Connecting…', idle: 'On demand', offline: 'Offline'}[state];
  }

  return Object.freeze({ playerName, roomCode, createRoomButton, joinRoomButton, readyButton, teamAButton, teamBButton, teamModeButton, survivalModeButton, startGameButton, returnToLobbyButton, leavePartyButton, setServerStatus, setMessage: value => { actionMessage.textContent = value; }, setBusy, renderRoom });
}

function esc(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}
