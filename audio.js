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
const MASTER_VOLUME=.9;
const MAX_LATE_IMPACT_MS=2500;
const DEFAULT_POOL_SIZE=4;
const BUSY_POOL_SIZE=9;
const state={unlocked:false,previousRoom:null,seen:new Set(),timers:new Map(),warningAudio:null,warningKey:null};
const pools=new Map();

function poolSize(name){return ['basic','basicExplosion'].includes(name)?BUSY_POOL_SIZE:DEFAULT_POOL_SIZE;}
function makeVoice(src){const audio=new Audio(src);audio.preload='auto';return audio;}
for(const [name,src] of Object.entries(SFX))pools.set(name,Array.from({length:poolSize(name)},()=>makeVoice(src)));

function acquireVoice(name){
  const pool=pools.get(name);if(!pool)return null;
  let audio=pool.find(voice=>voice.paused||voice.ended);
  if(!audio){audio=makeVoice(SFX[name]);pool.push(audio);}
  return audio;
}
function play(name,{volume=1,loop=false}={}){
  if(!state.unlocked)return null;
  const audio=acquireVoice(name);if(!audio)return null;
  audio.volume=Math.max(0,Math.min(1,MASTER_VOLUME*volume));audio.loop=loop;
  try{audio.currentTime=0;}catch{}
  audio.play().catch(error=>console.warn(`[Orbital Artillery] SFX playback failed: ${name}`,error));
  return audio;
}
function stop(audio){if(!audio)return;audio.pause();audio.loop=false;try{audio.currentTime=0;}catch{}}
function once(key,fn){if(state.seen.has(key))return false;state.seen.add(key);fn();return true;}
function schedule(key,at,fn,{maxLateMs=Infinity}={}){
  if(state.seen.has(key))return false;
  const target=Number(at??Date.now()),now=Date.now(),lateness=Number.isFinite(target)?now-target:0;
  if(Number.isFinite(maxLateMs)&&lateness>maxLateMs){state.seen.add(key);return false;}
  state.seen.add(key);
  const delay=Math.max(0,(Number.isFinite(target)?target:now)-now);
  const timer=setTimeout(()=>{state.timers.delete(key);fn();},delay);
  state.timers.set(key,timer);
  return true;
}
function scheduleLocal(key,delayMs,fn){
  if(state.seen.has(key))return false;
  state.seen.add(key);
  const delay=Math.max(0,Number(delayMs)||0);
  const timer=setTimeout(()=>{state.timers.delete(key);fn();},delay);
  state.timers.set(key,timer);
  return true;
}
function relativeDelay(targetAt,anchorAt,extra=0){
  const target=Number(targetAt),anchor=Number(anchorAt);
  if(!Number.isFinite(target)||!Number.isFinite(anchor))return Math.max(0,Number(extra)||0);
  return Math.max(0,target-anchor+(Number(extra)||0));
}
function projectileKey(q){return String(q?.id??`${q?.ownerPlayerId??'x'}:${q?.weaponType??'basic'}:${q?.startedAt??q?.impactAt??0}`);}
function stopWarning(){stop(state.warningAudio);state.warningAudio=null;state.warningKey=null;}
function validImpact(p){return p&&Number.isFinite(Number(p.impactAt));}

function scheduleProjectile(q){
  if(!q)return;
  const root=projectileKey(q),type=q.weaponType??'basic';
  if(type==='basic'){
    once(`${root}:basic-launch`,()=>play('basic'));
    if(validImpact(q))schedule(`${root}:basic-explosion`,q.impactAt,()=>play('basicExplosion'),{maxLateMs:MAX_LATE_IMPACT_MS});
  }else if(type==='heavy'){
    once(`${root}:heavy-launch`,()=>play('heavy'));
    if(validImpact(q))schedule(`${root}:heavy-explosion`,q.impactAt,()=>play('loudExplosion',{volume:.96}),{maxLateMs:MAX_LATE_IMPACT_MS});
  }else if(type==='triple'){
    const volley=q.volley?.length?q.volley:[q,q,q];
    for(const [index,v] of volley.entries()){
      scheduleLocal(`${root}:triple-launch:${index}`,index*65,()=>play('basic'));
      if(validImpact(v))schedule(`${root}:triple-explosion:${index}`,v.impactAt,()=>play('basicExplosion',{volume:.92}),{maxLateMs:MAX_LATE_IMPACT_MS});
    }
  }else if(type==='cluster'){
    once(`${root}:cluster-main-launch`,()=>play('heavy'));
    if(validImpact(q))schedule(`${root}:cluster-main-explosion`,q.impactAt,()=>play('loudExplosion',{volume:.96}),{maxLateMs:MAX_LATE_IMPACT_MS});
    const launchHold=Number(q.authoritativeVisualDelay7A)||0;
    for(const [index,child] of (q.clusterImpacts??[]).entries()){
      const childStart=child.visualStartAt??child.impactAt;
      scheduleLocal(`${root}:cluster-child-launch:${index}`,relativeDelay(childStart,q.startedAt,launchHold),()=>play('basic',{volume:.9}));
      if(validImpact(child))schedule(`${root}:cluster-child-explosion:${index}`,child.impactAt,()=>play('basicExplosion',{volume:.88}),{maxLateMs:MAX_LATE_IMPACT_MS});
    }
  }else if(type==='airstrike'){
    once(`${root}:air-begin-launch`,()=>play('airBegin'));
    for(const [index,shell] of (q.airStrikeShells??[]).entries()){
      const visualStart=shell.visualStartAt??shell.startedAt??shell.impactAt;
      scheduleLocal(`${root}:air-shell-launch:${index}`,relativeDelay(visualStart,q.startedAt),()=>play('basic',{volume:.68}));
      if(validImpact(shell))schedule(`${root}:air-impact-explosion:${index}`,shell.impactAt,()=>play('basicExplosion',{volume:.9}),{maxLateMs:MAX_LATE_IMPACT_MS});
    }
  }else if(type==='nuke'){
    const warningAt=q.targetLockedAt??q.impactAt??q.startedAt;
    const beamAt=q.beamAt??q.warningUntil??q.impactAt??q.startedAt;
    const launchHold=Number(q.authoritativeVisualDelay7A)||0;
    scheduleLocal(`${root}:warning`,relativeDelay(warningAt,q.startedAt,launchHold),()=>{
      stopWarning();
      state.warningKey=root;
      state.warningAudio=play('warning',{volume:.92,loop:true});
    });
    scheduleLocal(`${root}:nuke`,relativeDelay(beamAt,q.startedAt,launchHold),()=>{
      if(state.warningKey===root)stopWarning();
      play('nuke',{volume:.72});
      play('nukeExplosion',{volume:.98});
    });
  }
}

function detectInstantUtilities(previous,room){
  if(!previous||previous.status!=='started'||room?.status!=='started')return;
  if(Number(previous.match?.turnNumber)!==Number(room.match?.turnNumber))return;
  const before=new Map((previous.players??[]).map(p=>[p.id,p]));
  for(const player of room.players??[]){
    const old=before.get(player.id);if(!old)continue;
    if(!old.shield&&player.shield)once(`shield:${room.code}:${room.match?.turnNumber}:${player.id}`,()=>play('shield'));
    if(Number(player.hp)>Number(old.hp))once(`health:${room.code}:${room.match?.turnNumber}:${player.id}:${player.hp}`,()=>play('health'));
  }
}
function update(room){
  detectInstantUtilities(state.previousRoom,room);
  const previousQ=state.previousRoom?.match?.projectile,currentQ=room?.match?.projectile;
  if(currentQ&&projectileKey(currentQ)!==projectileKey(previousQ))scheduleProjectile(currentQ);
  if(!currentQ&&previousQ?.weaponType==='nuke')stopWarning();
  state.previousRoom=room;
}
function unlock(){
  if(state.unlocked)return;state.unlocked=true;
  for(const pool of pools.values())for(const audio of pool)audio.load();
}

export function createAudioSystem(){
  window.addEventListener('orbital-room-state',event=>update(event.detail));
  window.addEventListener('pointerdown',unlock,{once:true,capture:true});
  window.addEventListener('keydown',unlock,{once:true,capture:true});
  return Object.freeze({enabled:true,play,update});
}

createAudioSystem();
