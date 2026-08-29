const SFX=Object.freeze({
  basic:'assets/music/basic_shot.mp3',
  heavy:'assets/music/heavy_bomb.mp3',
  airBegin:'assets/music/air_strike_begin.mp3',
  nuke:'assets/music/nuke.mp3',
  warning:'assets/music/warning.mp3',
  shield:'assets/music/shield.mp3',
  health:'assets/music/health.mp3',
  basicExplosion:'assets/music/basic_explosion.mp3',
  loudExplosion:'assets/music/loud_explosion.mp3',
  nukeExplosion:'assets/music/nuke_explosion.mp3'
});
const SFX_HEADROOM=.9;
const STORAGE_KEY='orbital-artillery-master-volume';
const LEGACY_STORAGE_KEY='orbital-artillery-music-volume';
const VOLUME_EVENT='orbital-master-volume';
const DEFAULT_POOL_SIZE=4;
const BUSY_POOL_SIZE=10;
const PENDING_MAX_AGE_MS=1200;
const pools=new Map();
const voiceGain=new WeakMap();
const initialMaster=Math.max(0,Math.min(100,Number(localStorage.getItem(STORAGE_KEY)??localStorage.getItem(LEGACY_STORAGE_KEY)??72)));
const state={unlocked:false,previousRoom:null,seen:new Set(),pendingVisual:new Map(),warningAudio:null,warningKey:null,nukeTimers:new Map(),masterVolume:initialMaster};

function poolSize(name){return ['basic','basicExplosion'].includes(name)?BUSY_POOL_SIZE:DEFAULT_POOL_SIZE;}
function makeVoice(src){const audio=new Audio(src);audio.preload='auto';voiceGain.set(audio,1);return audio;}
for(const [name,src] of Object.entries(SFX))pools.set(name,Array.from({length:poolSize(name)},()=>makeVoice(src)));
function acquireVoice(name){const pool=pools.get(name);if(!pool)return null;let audio=pool.find(v=>v.paused||v.ended);if(!audio){audio=makeVoice(SFX[name]);pool.push(audio);}return audio;}
function effectiveVolume(audio){return Math.max(0,Math.min(1,SFX_HEADROOM*(state.masterVolume/100)*(voiceGain.get(audio)??1)));}
function applyMasterVolume(){for(const pool of pools.values())for(const audio of pool)audio.volume=effectiveVolume(audio);}
function setMasterVolume(value){state.masterVolume=Math.max(0,Math.min(100,Math.round(Number(value)||0)));localStorage.setItem(STORAGE_KEY,String(state.masterVolume));applyMasterVolume();}
function play(name,{volume=1,loop=false}={}){
  if(!state.unlocked)return null;
  const audio=acquireVoice(name);if(!audio)return null;
  voiceGain.set(audio,Math.max(0,Math.min(1,Number(volume)||0)));
  audio.volume=effectiveVolume(audio);audio.loop=loop;
  try{audio.currentTime=0;}catch{}
  audio.play().catch(error=>console.warn(`[Orbital Artillery] SFX playback failed: ${name}`,error));
  return audio;
}
function stop(audio){if(!audio)return;audio.pause();audio.loop=false;try{audio.currentTime=0;}catch{}}
function once(key,fn){if(state.seen.has(key))return false;state.seen.add(key);fn();return true;}
function stopWarning(){stop(state.warningAudio);state.warningAudio=null;state.warningKey=null;}
function projectileKey(q){return String(q?.id??`${q?.ownerPlayerId??'x'}:${q?.weaponType??'basic'}:${q?.startedAt??q?.impactAt??0}`);}
function relativeDelay(targetAt,anchorAt,extra=0){const target=Number(targetAt),anchor=Number(anchorAt);if(!Number.isFinite(target)||!Number.isFinite(anchor))return Math.max(0,Number(extra)||0);return Math.max(0,target-anchor+(Number(extra)||0));}
function scheduleNukeTimer(key,delay,fn){if(state.nukeTimers.has(key)||state.seen.has(key))return;state.seen.add(key);const timer=setTimeout(()=>{state.nukeTimers.delete(key);fn();},Math.max(0,delay));state.nukeTimers.set(key,timer);}
function scheduleNuke(q){
  if(!q||q.weaponType!=='nuke')return;
  const root=projectileKey(q),warningAt=q.targetLockedAt??q.impactAt??q.startedAt,beamAt=q.beamAt??q.warningUntil??q.impactAt??q.startedAt,launchHold=Number(q.authoritativeVisualDelay7A)||0;
  scheduleNukeTimer(`${root}:warning`,relativeDelay(warningAt,q.startedAt,launchHold),()=>{stopWarning();state.warningKey=root;state.warningAudio=play('warning',{volume:.92,loop:true});});
  scheduleNukeTimer(`${root}:nuke`,relativeDelay(beamAt,q.startedAt,launchHold),()=>{if(state.warningKey===root)stopWarning();play('nuke',{volume:.72});play('nukeExplosion',{volume:.98});});
}
function detectInstantUtilities(previous,room){
  if(!previous||previous.status!=='started'||room?.status!=='started')return;
  if(Number(previous.match?.turnNumber)!==Number(room.match?.turnNumber))return;
  const before=new Map((previous.players??[]).map(p=>[p.id,p]));
  for(const player of room.players??[]){const old=before.get(player.id);if(!old)continue;if(!old.shield&&player.shield)once(`shield:${room.code}:${room.match?.turnNumber}:${player.id}`,()=>play('shield'));if(Number(player.hp)>Number(old.hp))once(`health:${room.code}:${room.match?.turnNumber}:${player.id}:${player.hp}`,()=>play('health'));}
}
function update(room){
  detectInstantUtilities(state.previousRoom,room);
  const previousQ=state.previousRoom?.match?.projectile,currentQ=room?.match?.projectile;
  if(currentQ?.weaponType==='nuke'&&projectileKey(currentQ)!==projectileKey(previousQ))scheduleNuke(currentQ);
  if(!currentQ&&previousQ?.weaponType==='nuke')stopWarning();
  state.previousRoom=room;
}
function consumeVisual(detail){
  if(!detail?.key||!SFX[detail.name]||state.seen.has(`visual:${detail.key}`))return;
  once(`visual:${detail.key}`,()=>play(detail.name,{volume:Number.isFinite(Number(detail.volume))?Number(detail.volume):1}));
}
function handleVisualSfx(event){
  const detail=event?.detail;if(!detail?.key||!SFX[detail.name])return;
  if(!state.unlocked){state.pendingVisual.set(detail.key,{...detail,emittedAt:Number(detail.emittedAt)||Date.now()});return;}
  consumeVisual(detail);
}
function flushPendingVisual(){
  const now=Date.now();
  for(const detail of state.pendingVisual.values())if(now-Number(detail.emittedAt)<=PENDING_MAX_AGE_MS)consumeVisual(detail);
  state.pendingVisual.clear();
}
function unlock(){
  if(state.unlocked)return;
  state.unlocked=true;
  for(const pool of pools.values())for(const audio of pool)audio.load();
  applyMasterVolume();
  flushPendingVisual();
}

window.addEventListener('orbital-room-state',event=>update(event.detail));
window.addEventListener('orbital-visual-sfx',handleVisualSfx);
window.addEventListener(VOLUME_EVENT,event=>setMasterVolume(event.detail?.value));
window.addEventListener('pointerdown',unlock,{once:true,capture:true});
window.addEventListener('keydown',unlock,{once:true,capture:true});

export function createAudioSystem(){return Object.freeze({enabled:true,play,update,setMasterVolume});}
