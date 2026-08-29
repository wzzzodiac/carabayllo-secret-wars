const TRACKS=Object.freeze({
  lobby:{src:'assets/music/sports opener.mp3',label:'SPORTS OPENER'},
  early:{src:'assets/music/dark.mp3',label:'DARK'},
  late:{src:'assets/music/adrenaline.mp3',label:'ADRENALINE'}
});
const FADE_IN_MS=1800;
const FADE_OUT_MS=2200;
const TURN9_FADE_MS=5000;
const LOOP_FADE_SECONDS=2.8;
const STORAGE_KEY='orbital-artillery-master-volume';
const LEGACY_STORAGE_KEY='orbital-artillery-music-volume';
const VOLUME_EVENT='orbital-master-volume';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ramps=new WeakMap();
const tracks=new Map();
const storedMaster=localStorage.getItem(STORAGE_KEY);
const legacyMaster=localStorage.getItem(LEGACY_STORAGE_KEY);
const initialVolume=clamp(Number(storedMaster??legacyMaster??72),0,100);
if(storedMaster==null)localStorage.setItem(STORAGE_KEY,String(initialVolume));
const state={
  unlocked:false,
  room:null,
  desiredKey:'lobby',
  currentKey:null,
  current:null,
  transitionToken:0,
  volume:initialVolume,
  loopFading:false
};
const targetGain=()=>state.volume/100;

function cancelRamp(audio){const timer=audio?ramps.get(audio):null;if(timer)cancelAnimationFrame(timer);if(audio)ramps.delete(audio);}
function ramp(audio,from,to,duration,onDone){
  if(!audio){onDone?.();return;}
  cancelRamp(audio);
  const started=performance.now(),span=Math.max(1,duration);
  audio.volume=clamp(from,0,1);
  const tick=now=>{
    const t=clamp((now-started)/span,0,1);
    audio.volume=clamp(from+(to-from)*t,0,1);
    if(t>=1){ramps.delete(audio);onDone?.();return;}
    ramps.set(audio,requestAnimationFrame(tick));
  };
  ramps.set(audio,requestAnimationFrame(tick));
}
function stopAudio(audio,{reset=true}={}){if(!audio)return;cancelRamp(audio);audio.pause();if(reset){try{audio.currentTime=0;}catch{}}}
function getTrack(key){
  if(tracks.has(key))return tracks.get(key);
  const meta=TRACKS[key];if(!meta)return null;
  const audio=new Audio(meta.src);audio.preload='auto';audio.loop=false;audio.volume=0;audio.dataset.orbitalTrack=key;
  audio.addEventListener('error',()=>console.error(`[Carabayllo Secret Wars] Could not load music asset: ${meta.src}`));
  audio.addEventListener('ended',()=>{if(audio===state.current&&key===state.desiredKey)restartLoop(audio,key);});
  tracks.set(key,audio);return audio;
}
for(const key of Object.keys(TRACKS))getTrack(key);

async function safePlay(audio){try{await audio.play();return true;}catch(error){console.warn('[Carabayllo Secret Wars] Music playback blocked/failed',error);return false;}}
async function restartLoop(audio,key){
  if(!state.unlocked||audio!==state.current||key!==state.desiredKey)return;
  state.loopFading=true;cancelRamp(audio);
  try{audio.currentTime=0;}catch{}
  audio.volume=0;
  if(await safePlay(audio))ramp(audio,0,targetGain(),FADE_IN_MS,()=>{if(audio===state.current&&key===state.desiredKey)state.loopFading=false;});
  else state.loopFading=false;
}
function beginLoopFade(audio,key){
  if(state.loopFading||audio!==state.current||key!==state.desiredKey)return;
  const remaining=Number.isFinite(audio.duration)?audio.duration-audio.currentTime:LOOP_FADE_SECONDS;
  if(remaining>LOOP_FADE_SECONDS||remaining<=0)return;
  state.loopFading=true;
  ramp(audio,audio.volume,0,Math.max(450,remaining*1000-90),()=>restartLoop(audio,key));
}
function desiredTrack(room){
  if(!room||room.status!=='started')return'lobby';
  const turn=Number(room.match?.turnNumber??1);
  if(turn>=10)return'late';
  if(turn===9)return null;
  return'early';
}
async function transitionTo(key,{fadeOut=FADE_OUT_MS,fadeIn=FADE_IN_MS}={}){
  state.desiredKey=key;
  if(!state.unlocked)return;
  const token=++state.transitionToken;
  const previous=state.current;
  const previousKey=state.currentKey;
  if(key===previousKey&&previous){
    if(previous.paused||previous.ended)await restartLoop(previous,key);
    else if(!state.loopFading&&Math.abs(previous.volume-targetGain())>.015)ramp(previous,previous.volume,targetGain(),350);
    return;
  }
  if(key==null){
    state.current=null;state.currentKey=null;state.loopFading=false;
    if(previous)ramp(previous,previous.volume,0,fadeOut,()=>stopAudio(previous));
    return;
  }
  const next=getTrack(key);if(!next)return;
  state.current=next;state.currentKey=key;state.loopFading=false;
  if(previous&&previous!==next)ramp(previous,previous.volume,0,fadeOut,()=>{if(previous!==state.current)stopAudio(previous);});
  cancelRamp(next);try{next.currentTime=0;}catch{}next.volume=0;
  const played=await safePlay(next);
  if(token!==state.transitionToken||state.current!==next||state.desiredKey!==key){if(next!==state.current)stopAudio(next);return;}
  if(!played)return;
  ramp(next,0,targetGain(),fadeIn);
}
function syncMusic(room){
  state.room=room;
  const key=desiredTrack(room);
  const turn=Number(room?.match?.turnNumber??0);
  transitionTo(key,{fadeOut:room?.status==='started'&&turn===9?TURN9_FADE_MS:FADE_OUT_MS,fadeIn:FADE_IN_MS});
}
function publishVolume(){window.dispatchEvent(new CustomEvent(VOLUME_EVENT,{detail:{value:state.volume}}));}
function setVolume(value,{publish=true}={}){
  state.volume=clamp(Math.round(Number(value)||0),0,100);localStorage.setItem(STORAGE_KEY,String(state.volume));
  volumeValue.textContent=`${state.volume}%`;slider.value=String(state.volume);speaker.textContent=state.volume===0?'🔇':state.volume<35?'🔈':state.volume<70?'🔉':'🔊';
  if(state.current&&!state.loopFading)ramp(state.current,state.current.volume,targetGain(),180);
  if(publish)publishVolume();
}

const control=document.createElement('div');
Object.assign(control.style,{position:'fixed',right:'18px',bottom:'18px',zIndex:'70',display:'flex',alignItems:'center',gap:'8px',padding:'8px 10px',border:'1px solid rgba(140,180,255,.28)',borderRadius:'10px',background:'rgba(3,7,15,.88)',backdropFilter:'blur(10px)',boxShadow:'0 8px 24px rgba(0,0,0,.28)'});
const speaker=document.createElement('button');speaker.type='button';speaker.setAttribute('aria-label','Game volume');Object.assign(speaker.style,{minWidth:'34px',height:'30px',padding:'0 6px',fontSize:'17px',lineHeight:'1',cursor:'default'});
const flyout=document.createElement('div');Object.assign(flyout.style,{display:'none',alignItems:'center',gap:'8px'});
const slider=document.createElement('input');slider.type='range';slider.min='0';slider.max='100';slider.step='1';slider.setAttribute('aria-label','Game volume 0 to 100');Object.assign(slider.style,{width:'150px',cursor:'pointer'});
const volumeValue=document.createElement('strong');Object.assign(volumeValue.style,{font:'800 11px ui-monospace,monospace',minWidth:'38px',textAlign:'right',color:'#e7edff'});
flyout.append(slider,volumeValue);control.append(speaker,flyout);document.body.appendChild(control);
let hideTimer=null;const show=()=>{if(hideTimer)clearTimeout(hideTimer);flyout.style.display='flex';};const hide=()=>{hideTimer=setTimeout(()=>{if(!control.matches(':hover')&&!control.contains(document.activeElement))flyout.style.display='none';},280);};control.addEventListener('mouseenter',show);control.addEventListener('mouseleave',hide);control.addEventListener('focusin',show);control.addEventListener('focusout',hide);slider.addEventListener('input',()=>setVolume(slider.value));speaker.addEventListener('click',()=>{show();slider.focus();});setVolume(state.volume);

async function unlock(){
  if(state.unlocked)return;
  state.unlocked=true;
  for(const audio of tracks.values())audio.load();
  await transitionTo(desiredTrack(state.room));
}
window.addEventListener('orbital-room-state',event=>syncMusic(event.detail));
window.addEventListener('pointerdown',unlock,{once:true,capture:true});
window.addEventListener('keydown',unlock,{once:true,capture:true});

function monitor(){
  const audio=state.current,key=state.currentKey;
  if(state.unlocked&&audio&&key===state.desiredKey&&!audio.paused&&!state.loopFading)beginLoopFade(audio,key);
  requestAnimationFrame(monitor);
}
requestAnimationFrame(monitor);
syncMusic(null);
