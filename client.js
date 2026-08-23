import { CLIENT_CONFIG } from './config.js';
import { createSocketBoundary } from './socket.js';
import { createRenderer } from './renderer.js?v=phase6a-sidehud-1';
import { createUI } from './ui.js?v=phase5b-combat-1';
import { initWindGusts } from './wind-gusts.js?v=phase3-wind-1';
import { initCombatControls } from './combat-controls.js?v=phase6a-pickupshot-1';

const canvas = document.getElementById('gameCanvas');
const ui = createUI();
const renderer = createRenderer(canvas, CLIENT_CONFIG);
const windGusts = initWindGusts(canvas);
const combatControls = initCombatControls(canvas);
const socketBoundary = createSocketBoundary();

let activeSocket = null, playerId = null, currentRoom = null, disconnectHandlerBound = false;
let heldMoveDirection = 0, moveTimer = null, moveInFlight = false, pendingAngleDelta = 0, pendingPowerDelta = 0, aimPumpPromise = null;
const lastAuthoritativeSpawns = new Map();
const visualMotionClock = new Map();
const MOVE_INTERVAL_MS = 70, MOVE_VISUAL_MS = 110;

const terrainGroup = document.createElement('div');
terrainGroup.className = 'control-group';
terrainGroup.innerHTML = '<span class="control-label" id="terrainControlLabel">TERRAIN // HOST</span><select id="terrainSelect" aria-label="Terrain preset"></select>';
ui.readyButton.parentElement.insertBefore(terrainGroup, ui.readyButton);
const terrainSelect = terrainGroup.querySelector('#terrainSelect');
const terrainControlLabel = terrainGroup.querySelector('#terrainControlLabel');

renderer.drawScaffold();
ui.setClientStatus('READY');
ui.setServerStatus(socketBoundary.isConfigured ? 'OFFLINE / ON DEMAND' : 'NOT CONFIGURED');
ui.playerName.value = localStorage.getItem('orbital-artillery-player-name') || '';

const humanError = code => ({
  invalid_name:'Enter a player name first.', invalid_room_code:'Room code must contain 4 valid characters.', room_not_found:'That room does not exist.', room_full:'That room already has 8 players.', room_already_started:'That room has already started.', server_room_capacity:'The server has reached its temporary room limit.', room_action_rate_limited:'Too many lobby requests. Wait a moment.', already_in_room:'This tab is already inside a room.', not_in_room:'This tab is not currently inside a room.', invalid_team:'That team selection is invalid.', team_full:'That team already has 4 players.', teams_disabled:'Teams are disabled in Survival mode.', invalid_mode:'That game mode is invalid.', invalid_terrain:'That terrain is invalid.', host_only:'Only the host can do that.', not_enough_players:'At least 2 players are required.', players_not_ready:'Every player must be READY.', both_teams_required:'Both teams need at least one player.', request_timeout:'The server did not answer in time.', match_not_started:'The match is not active yet.', not_your_turn:'Wait for your turn.', shot_in_flight:'Your shot is already in flight.', player_in_motion:'Wait until the jump finishes.', invalid_direction:'Invalid movement direction.', movement_limit:'You reached this turn\'s movement radius.', terrain_too_steep:'That ledge is too steep to drive onto. Use a jump.', no_jumps_remaining:'No jumps remaining this turn.', player_missing:'Your vehicle is no longer active.', invalid_item_slot:'That weapon slot is invalid.', empty_item_slot:'That weapon slot is empty.'
}[code] || `Server rejected the request: ${code || 'unknown_error'}`);

function normalizeServerMotion(playerId, motion, now) {
  if (!motion) return motion;
  const goesIntoVoid = Number(motion.toY) > 5000;
  const visualType = motion.type === 'jump' && goesIntoVoid ? 'voidJump' : motion.type;
  if (!['jump','voidJump','fall','knockback','knockbackVoid'].includes(visualType)) return motion;
  const serverDuration = Number(motion.endsAt) - Number(motion.startedAt);
  const duration = visualType === 'voidJump' ? Math.max(1450, serverDuration || 620)
    : visualType === 'fall' && goesIntoVoid ? Math.max(980, serverDuration || 760)
      : ['knockback','knockbackVoid'].includes(visualType) ? Math.max(260, serverDuration || 520)
        : Math.max(280, serverDuration || 620);
  const signature = `${visualType}:${motion.startedAt}:${motion.fromX}:${motion.fromY}:${motion.toX}:${motion.toY}:${motion.vx ?? 0}:${motion.vy ?? 0}`;
  let visual = visualMotionClock.get(playerId);
  if (!visual || visual.signature !== signature) {
    visual = { signature, startedAt: now, endsAt: now + duration };
    visualMotionClock.set(playerId, visual);
  }
  return { ...motion, type: visualType, startedAt: visual.startedAt, endsAt: visual.endsAt };
}

function makeDisplayRoom(room) {
  const now = Date.now();
  return {
    ...room,
    pickups: (room.pickups ?? []).map(pickup => ({ ...pickup })),
    match: room.match ? { ...room.match, movementOriginX: null } : null,
    camera: room.camera ? { ...room.camera } : null,
    arena: room.arena ? { ...room.arena, craters: (room.arena.craters ?? []).map(crater => ({ ...crater })), previewSpawns: [...(room.arena.previewSpawns ?? [])] } : null,
    players: room.players.map(player => {
      const next = { ...player, inventory: (player.inventory ?? []).map(item => item ? { ...item } : null), spawn: player.spawn ? { ...player.spawn } : null, motion: player.motion ? { ...player.motion } : null, lastDamage: player.lastDamage ? { ...player.lastDamage } : null };
      if (next.motion) next.motion = normalizeServerMotion(player.id, next.motion, now);
      const previous = lastAuthoritativeSpawns.get(player.id);
      if (next.spawn && previous && !next.motion && next.alive !== false) {
        const moved = Math.abs(next.spawn.x - previous.x) > .01 || Math.abs(next.spawn.y - previous.y) > .01;
        if (moved) next.motion = { type:'move', startedAt:now, endsAt:now+MOVE_VISUAL_MS, fromX:previous.x, fromY:previous.y, toX:next.spawn.x, toY:next.spawn.y, apex:0 };
      }
      if (next.spawn) lastAuthoritativeSpawns.set(player.id, { ...next.spawn });
      return next;
    })
  };
}

function stopHeldMove(){heldMoveDirection=0;if(moveTimer)clearInterval(moveTimer);moveTimer=null;}
function clearPendingAim(){pendingAngleDelta=0;pendingPowerDelta=0;}
function syncTerrainOptions(room){const entries=room?.terrainPresets??[],signature=entries.map(entry=>`${entry.id}:${entry.name}`).join('|');if(terrainSelect.dataset.signature!==signature){terrainSelect.innerHTML='';for(const entry of entries){const option=document.createElement('option');option.value=entry.id;option.textContent=entry.name;terrainSelect.appendChild(option);}terrainSelect.dataset.signature=signature;}}
function updateTerrainControl(room){syncTerrainOptions(room);const me=room?.players?.find(player=>player.id===playerId);terrainGroup.hidden=!room||room.status!=='lobby';terrainSelect.disabled=!me?.isHost||room?.status!=='lobby';if(room?.terrainPreset)terrainSelect.value=room.terrainPreset;const selectedName=room?.terrainPresets?.find(entry=>entry.id===room.terrainPreset)?.name??terrainSelect.selectedOptions[0]?.textContent??'—';terrainControlLabel.textContent=me?.isHost?`TERRAIN // HOST // ${selectedName}`:`TERRAIN // ${selectedName}`;}

function renderRoom(room){currentRoom=room;if(['started','finished'].includes(room?.status)&&['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))document.activeElement.blur();const me=room?.players?.find(player=>player.id===playerId);if(room?.status!=='started'||room?.match?.activePlayerId!==playerId||room?.match?.projectile||me?.alive===false){stopHeldMove();clearPendingAim();}updateTerrainControl(room);ui.renderRoom(room,playerId);renderer.drawArena(makeDisplayRoom(room),playerId);windGusts.update(room);combatControls.update(room,playerId);}

async function ensureConnection(){ui.setBusy(true);ui.setServerStatus('CONNECTING');try{activeSocket=await socketBoundary.connect();ui.setServerStatus('CONNECTED');activeSocket.off('room_state');activeSocket.on('room_state',renderRoom);if(!disconnectHandlerBound){activeSocket.on('disconnect',()=>{disconnectHandlerBound=false;stopHeldMove();clearPendingAim();ui.setServerStatus('OFFLINE');ui.setMessage('Connection closed. Create or join again.');});disconnectHandlerBound=true;}return activeSocket;}finally{ui.setBusy(false);}}
function request(event,payload={}){return new Promise(resolve=>activeSocket.timeout(8000).emit(event,payload,(err,result)=>resolve(err?{ok:false,error:'request_timeout'}:result||{ok:false,error:'empty_response'})));}
function name(){const value=ui.playerName.value.trim().slice(0,20);if(value)localStorage.setItem('orbital-artillery-player-name',value);return value;}
async function createRoom(){const value=name();if(!value)return ui.setMessage('Enter a player name first.');await ensureConnection();const result=await request('create_room',{name:value});if(!result.ok)return ui.setMessage(humanError(result.error));playerId=result.playerId;renderRoom(result.room);ui.setMessage(`Room ${result.room.code} created.`);}
async function joinRoom(){const value=name(),code=ui.roomCode.value.trim().toUpperCase();ui.roomCode.value=code;if(!value)return ui.setMessage('Enter a player name first.');if(code.length!==4)return ui.setMessage('Enter the 4-character room code.');await ensureConnection();const result=await request('join_room',{name:value,code});if(!result.ok)return ui.setMessage(humanError(result.error));playerId=result.playerId;renderRoom(result.room);ui.setMessage(`Joined room ${result.room.code}.`);}
async function mutate(event,payload,message){if(!activeSocket)return null;const result=await request(event,payload);if(!result.ok){ui.setMessage(humanError(result.error));return result;}renderRoom(result.room);if(message)ui.setMessage(message);return result;}

ui.createRoomButton.addEventListener('click',createRoom);ui.joinRoomButton.addEventListener('click',joinRoom);
ui.readyButton.addEventListener('click',()=>{const me=currentRoom?.players.find(player=>player.id===playerId);if(me)mutate('set_ready',{ready:!me.ready},!me.ready?'You are READY.':'Ready cancelled.');});
ui.teamAButton.addEventListener('click',()=>mutate('set_team',{team:'A'},'Moved to Team A.'));ui.teamBButton.addEventListener('click',()=>mutate('set_team',{team:'B'},'Moved to Team B.'));
ui.teamModeButton.addEventListener('click',()=>mutate('set_mode',{mode:'team'},'Team mode selected. READY states reset.'));ui.survivalModeButton.addEventListener('click',()=>mutate('set_mode',{mode:'survival'},'Survival mode selected. READY states reset.'));
terrainSelect.addEventListener('change',()=>{const selectedName=terrainSelect.selectedOptions[0]?.textContent??'Terrain';mutate('set_terrain',{terrain:terrainSelect.value},`${selectedName} selected. Preview updated; READY states reset.`);});
ui.startGameButton.addEventListener('click',()=>mutate('start_game',{},'Match countdown started.'));ui.roomCode.addEventListener('input',()=>{ui.roomCode.value=ui.roomCode.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,4);});

function isMyActionTurn(){const me=currentRoom?.players.find(player=>player.id===playerId);return currentRoom?.status==='started'&&currentRoom.match?.activePlayerId===playerId&&!currentRoom.match?.projectile&&me?.alive!==false;}
async function sendMoveStep(){if(!heldMoveDirection||!isMyActionTurn()||moveInFlight||!activeSocket)return;moveInFlight=true;try{const result=await request('move_player',{direction:heldMoveDirection});if(!result.ok){if(['movement_limit','terrain_too_steep','not_your_turn','shot_in_flight','player_missing'].includes(result.error))stopHeldMove();if(result.error!=='movement_limit')ui.setMessage(humanError(result.error));return;}renderRoom(result.room);}finally{moveInFlight=false;}}
function startHeldMove(direction){heldMoveDirection=direction;if(!moveTimer){sendMoveStep();moveTimer=setInterval(sendMoveStep,MOVE_INTERVAL_MS);}}
function queueAim(angleDelta=0,powerDelta=0){if(!isMyActionTurn())return;pendingAngleDelta+=angleDelta;pendingPowerDelta+=powerDelta;if(aimPumpPromise)return;aimPumpPromise=(async()=>{while(isMyActionTurn()&&(pendingAngleDelta||pendingPowerDelta)){const angleStep=pendingAngleDelta,powerStep=pendingPowerDelta;pendingAngleDelta=0;pendingPowerDelta=0;const payload={};if(angleStep)payload.angle=(currentRoom.match?.aimAngle??45)+angleStep;if(powerStep)payload.power=(currentRoom.match?.aimPower??55)+powerStep;const result=await request('set_aim',payload);if(!result.ok){clearPendingAim();ui.setMessage(humanError(result.error));break;}renderRoom(result.room);}})().finally(()=>{aimPumpPromise=null;});}
async function fireShot(){stopHeldMove();if(aimPumpPromise)await aimPumpPromise;if(!isMyActionTurn())return;const me=currentRoom.players.find(player=>player.id===playerId),slot=me?.selectedItemSlot??1,item=slot>1?me?.inventory?.[slot-2]:null;await mutate('fire_projectile',{},item?.type==='heavy'?'Heavy Bomb fired.':'Shot fired.');}
function selectItem(slot){if(!currentRoom||!activeSocket||currentRoom.status!=='started')return;const me=currentRoom.players.find(player=>player.id===playerId);if(!me||me.alive===false)return;mutate('select_item',{slot},slot===1?'Basic weapon selected.':`Weapon ${slot} selected.`);}

document.getElementById('gameInfoPanel')?.addEventListener('click',event=>{const button=event.target.closest?.('[data-weapon-slot]');if(!button||button.disabled)return;selectItem(Number(button.dataset.weaponSlot));});
window.addEventListener('keydown',event=>{const code=event.code;if(['Digit1','Digit2','Digit3'].includes(code)&&!event.repeat){event.preventDefault();selectItem(Number(code.slice(-1)));return;}if(!isMyActionTurn())return;if(['KeyA','KeyD','KeyW','KeyS','KeyQ','KeyE','KeyF','Space'].includes(code))event.preventDefault();if(code==='KeyA'||code==='KeyD'){if(!event.repeat)startHeldMove(code==='KeyA'?-1:1);return;}if(code==='Space'&&!event.repeat){stopHeldMove();const me=currentRoom.players.find(player=>player.id===playerId);mutate('jump_player',{direction:me?.spawn?.facing||1});return;}if(code==='KeyW'||code==='KeyS'){stopHeldMove();queueAim(code==='KeyW'?3:-3,0);return;}if(code==='KeyQ'||code==='KeyE'){stopHeldMove();queueAim(0,code==='KeyE'?5:-5);return;}if(code==='KeyF'&&!event.repeat)fireShot();});
window.addEventListener('keyup',event=>{if((event.code==='KeyA'&&heldMoveDirection<0)||(event.code==='KeyD'&&heldMoveDirection>0))stopHeldMove();});
window.addEventListener('blur',stopHeldMove);window.addEventListener('pagehide',()=>{stopHeldMove();clearPendingAim();combatControls.destroy();windGusts.destroy();socketBoundary.disconnect();});
console.info('Orbital Artillery Phase 6A side HUD and 1/2/3 weapon selection ready.');
