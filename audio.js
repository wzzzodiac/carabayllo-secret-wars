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
const state={unlocked:false,previousRoom:null,seen:new Set(),timers:new Map(),warningAudio:null,warningKey:null};
const preload=new Map();
for(const [key,src] of Object.entries(SFX)){const audio=new Audio(src);audio.preload='auto';preload.set(key,audio);}

function play(name,{volume=1,loop=false}={}){
  if(!state.unlocked)return null;
  const src=SFX[name];if(!src)return null;
  const audio=new Audio(src);audio.preload='auto';audio.volume=Math.max(0,Math.min(1,MASTER_VOLUME*volume));audio.loop=loop;
  audio.play().catch(()=>{});
  return audio;
}
function stop(audio){if(!audio)return;audio.pause();try{audio.currentTime=0;}catch{}}
function once(key,fn){if(state.seen.has(key))return false;state.seen.add(key);fn();return true;}
function schedule(key,at,fn){
  if(state.seen.has(key))return;
  state.seen.add(key);
  const delay=Math.max(0,Number(at??Date.now())-Date.now());
  const timer=setTimeout(()=>{state.timers.delete(key);fn();},delay);
  state.timers.set(key,timer);
}
function projectileKey(q){return String(q?.id??`${q?.ownerPlayerId??'x'}:${q?.weaponType??'basic'}:${q?.startedAt??q?.impactAt??0}`);}
function stopWarning(){stop(state.warningAudio);state.warningAudio=null;state.warningKey=null;}
function validImpact(p){return p&&Number.isFinite(Number(p.impactAt));}

function scheduleProjectile(q){
  if(!q)return;
  const root=projectileKey(q),type=q.weaponType??'basic';
  if(type==='basic'){
    schedule(`${root}:basic`,q.startedAt,()=>play('basic'));
    if(validImpact(q))schedule(`${root}:basic-explosion`,q.impactAt,()=>play('basicExplosion'));
  }else if(type==='heavy'){
    schedule(`${root}:heavy`,q.startedAt,()=>play('heavy'));
    if(validImpact(q))schedule(`${root}:heavy-explosion`,q.impactAt,()=>play('loudExplosion',{volume:.96}));
  }else if(type==='triple'){
    for(const [index,v] of (q.volley??[]).entries()){
      schedule(`${root}:triple:${index}`,v.startedAt,()=>play('basic'));
      if(validImpact(v))schedule(`${root}:triple-explosion:${index}`,v.impactAt,()=>play('basicExplosion',{volume:.92}));
    }
  }else if(type==='cluster'){
    schedule(`${root}:cluster-main`,q.startedAt,()=>play('heavy'));
    if(validImpact(q))schedule(`${root}:cluster-main-explosion`,q.impactAt,()=>play('loudExplosion',{volume:.96}));
    for(const [index,child] of (q.clusterImpacts??[]).entries()){
      schedule(`${root}:cluster-child:${index}`,child.visualStartAt??child.impactAt,()=>play('basic',{volume:.9}));
      if(validImpact(child))schedule(`${root}:cluster-child-explosion:${index}`,child.impactAt,()=>play('basicExplosion',{volume:.88}));
    }
  }else if(type==='airstrike'){
    schedule(`${root}:air-begin`,q.startedAt??Date.now(),()=>play('airBegin'));
    for(const [index,shell] of (q.airStrikeShells??[]).entries()){
      schedule(`${root}:air-impact-shot:${index}`,shell.impactAt,()=>play('basic',{volume:.82}));
      if(validImpact(shell))schedule(`${root}:air-impact-explosion:${index}`,shell.impactAt,()=>play('basicExplosion',{volume:.9}));
    }
  }else if(type==='nuke'){
    once(`${root}:warning`,()=>{
      stopWarning();
      state.warningKey=root;
      state.warningAudio=play('warning',{volume:.92,loop:true});
    });
    const beamAt=q.beamAt??q.warningUntil??q.impactAt??Date.now();
    schedule(`${root}:nuke`,beamAt,()=>{
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
function unlock(){if(state.unlocked)return;state.unlocked=true;for(const audio of preload.values())audio.load();}

export function createAudioSystem(){
  window.addEventListener('orbital-room-state',event=>update(event.detail));
  window.addEventListener('pointerdown',unlock,{once:true,capture:true});
  window.addEventListener('keydown',unlock,{once:true,capture:true});
  return Object.freeze({enabled:true,play,update});
}

createAudioSystem();
