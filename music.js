const TRACKS=Object.freeze({
  lobby:{src:'assets/music/sports-opener-590001.mp3',label:'SPORTS OPENER'},
  early:{src:'assets/music/dark-571483.mp3',label:'DARK'},
  late:{src:'assets/music/adrenaline-576557.mp3',label:'ADRENALINE'}
});
const FADE_IN_MS=1800;
const FADE_OUT_MS=2200;
const TURN9_FADE_MS=5000;
const LOOP_FADE_SECONDS=2.8;
const STORAGE_KEY='orbital-artillery-music-volume';
const ramps=new WeakMap();
const state={unlocked:false,currentKey:null,current:null,room:null,volume:Math.max(0,Math.min(100,Number(localStorage.getItem(STORAGE_KEY)??72))),loopFadeStarted:false,fallbackStarted:false,fallbackTimer:null,fallbackContext:null,fallbackMaster:null};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const targetGain=()=>state.volume/100;

function cancelRamp(audio){const timer=audio?ramps.get(audio):null;if(timer)clearInterval(timer);if(audio)ramps.delete(audio);}
function ramp(audio,from,to,duration,onDone){
  if(!audio){onDone?.();return;}
  cancelRamp(audio);
  const started=performance.now(),span=Math.max(1,duration);audio.volume=clamp(from,0,1);
  const timer=setInterval(()=>{const t=clamp((performance.now()-started)/span,0,1);audio.volume=clamp(from+(to-from)*t,0,1);if(t>=1){cancelRamp(audio);onDone?.();}},40);
  ramps.set(audio,timer);
}
function stopAudio(audio){if(!audio)return;cancelRamp(audio);audio.pause();try{audio.currentTime=0;}catch{}}
function createTrack(key){
  const meta=TRACKS[key];if(!meta)return null;
  const audio=new Audio(meta.src);audio.preload='auto';audio.loop=false;audio.volume=0;audio.dataset.orbitalTrack=key;
  audio.addEventListener('error',()=>{if(state.current===audio){stopAudio(audio);state.current=null;state.currentKey=null;startFallback();}});
  audio.addEventListener('timeupdate',()=>{
    if(audio!==state.current||!Number.isFinite(audio.duration)||audio.duration<=0||state.loopFadeStarted)return;
    const remaining=audio.duration-audio.currentTime;
    if(remaining>LOOP_FADE_SECONDS)return;
    state.loopFadeStarted=true;
    const fadeMs=Math.max(500,remaining*1000-120);
    ramp(audio,audio.volume,0,fadeMs,async()=>{
      if(audio!==state.current)return;
      try{audio.currentTime=0;await audio.play();ramp(audio,0,targetGain(),FADE_IN_MS,()=>{if(audio===state.current)state.loopFadeStarted=false;});}
      catch{state.loopFadeStarted=false;startFallback();}
    });
  });
  return audio;
}
async function playKey(key,{fadeIn=FADE_IN_MS,fadeOut=FADE_OUT_MS}={}){
  if(!state.unlocked)return;
  if(key===state.currentKey&&state.current){if(Math.abs(state.current.volume-targetGain())>.02)ramp(state.current,state.current.volume,targetGain(),450);return;}
  const previous=state.current;
  if(!key){
    state.currentKey=null;state.current=null;state.loopFadeStarted=false;
    if(previous)ramp(previous,previous.volume,0,fadeOut,()=>stopAudio(previous));
    return;
  }
  const next=createTrack(key);
  try{await next.play();}catch{stopAudio(next);startFallback();return;}
  stopFallback();
  state.currentKey=key;state.current=next;state.loopFadeStarted=false;
  // Independent ramps intentionally overlap: this is a real crossfade, not fade-out-then-start.
  if(previous&&previous!==next)ramp(previous,previous.volume,0,fadeOut,()=>stopAudio(previous));
  ramp(next,0,targetGain(),fadeIn);
}
function desiredTrack(room){
  if(!room||room.status==='lobby'||room.status==='countdown'||room.status==='finished')return'lobby';
  if(room.status!=='started')return'lobby';
  const turn=Number(room.match?.turnNumber??1);
  if(turn>=10)return'late';
  if(turn===9)return null;
  return'early';
}
function syncMusic(room){
  state.room=room;
  const key=desiredTrack(room);
  if(room?.status==='started'&&Number(room.match?.turnNumber)===9)playKey(null,{fadeOut:TURN9_FADE_MS});
  else playKey(key);
}

// Fallback is only used if a local soundtrack asset is unavailable or cannot be played.
const NOTES={C4:261.63,D4:293.66,E4:329.63,G4:392,A4:440,C5:523.25,D5:587.33,E5:659.25,G5:783.99,A5:880};
const MELODY=['C5','E5','G5','E5','D5','G5','A5','G5','E5','D5','C5','E5','G5','D5','E5','C5'];
function ensureFallback(){if(state.fallbackContext)return state.fallbackContext;const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;state.fallbackContext=new C();state.fallbackMaster=state.fallbackContext.createGain();state.fallbackMaster.gain.value=targetGain()*.12;state.fallbackMaster.connect(state.fallbackContext.destination);return state.fallbackContext;}
function fallbackNote(freq,when,duration,volume=.05){const c=state.fallbackContext,m=state.fallbackMaster;if(!c||!m)return;const o=c.createOscillator(),g=c.createGain();o.type='triangle';o.frequency.value=freq;g.gain.setValueAtTime(.0001,when);g.gain.exponentialRampToValueAtTime(volume,when+.015);g.gain.exponentialRampToValueAtTime(.0001,when+duration);o.connect(g);g.connect(m);o.start(when);o.stop(when+duration+.03);}
function startFallback(){if(!state.unlocked||state.fallbackStarted)return;const c=ensureFallback();if(!c)return;c.resume?.();state.fallbackStarted=true;if(state.fallbackMaster)state.fallbackMaster.gain.setTargetAtTime(Math.max(.0001,targetGain()*.12),c.currentTime,.04);const bar=()=>{if(!state.fallbackStarted)return;const start=c.currentTime+.04;MELODY.forEach((n,i)=>fallbackNote(NOTES[n],start+i*.18,.14,i%4===0?.065:.045));};bar();state.fallbackTimer=setInterval(bar,MELODY.length*.18*1000);}
function stopFallback(){state.fallbackStarted=false;if(state.fallbackTimer)clearInterval(state.fallbackTimer);state.fallbackTimer=null;if(state.fallbackMaster&&state.fallbackContext)state.fallbackMaster.gain.setTargetAtTime(.0001,state.fallbackContext.currentTime,.06);}
function setVolume(value){
  state.volume=clamp(Math.round(Number(value)||0),0,100);localStorage.setItem(STORAGE_KEY,String(state.volume));
  volumeValue.textContent=`${state.volume}%`;slider.value=String(state.volume);speaker.textContent=state.volume===0?'🔇':state.volume<35?'🔈':state.volume<70?'🔉':'🔊';
  if(state.current)ramp(state.current,state.current.volume,targetGain(),180);
  if(state.fallbackMaster&&state.fallbackContext)state.fallbackMaster.gain.setTargetAtTime(Math.max(.0001,targetGain()*.12),state.fallbackContext.currentTime,.03);
}

const control=document.createElement('div');
Object.assign(control.style,{position:'fixed',right:'18px',bottom:'18px',zIndex:'70',display:'flex',alignItems:'center',gap:'8px',padding:'8px 10px',border:'1px solid rgba(140,180,255,.28)',borderRadius:'10px',background:'rgba(3,7,15,.88)',backdropFilter:'blur(10px)',boxShadow:'0 8px 24px rgba(0,0,0,.28)'});
const speaker=document.createElement('button');speaker.type='button';speaker.setAttribute('aria-label','Music volume');Object.assign(speaker.style,{minWidth:'34px',height:'30px',padding:'0 6px',fontSize:'17px',lineHeight:'1',cursor:'default'});
const flyout=document.createElement('div');Object.assign(flyout.style,{display:'none',alignItems:'center',gap:'8px'});
const slider=document.createElement('input');slider.type='range';slider.min='0';slider.max='100';slider.step='1';slider.setAttribute('aria-label','Music volume 0 to 100');Object.assign(slider.style,{width:'150px',cursor:'pointer'});
const volumeValue=document.createElement('strong');Object.assign(volumeValue.style,{font:'800 11px ui-monospace,monospace',minWidth:'38px',textAlign:'right',color:'#e7edff'});
flyout.append(slider,volumeValue);control.append(speaker,flyout);document.body.appendChild(control);
let hideTimer=null;const show=()=>{if(hideTimer)clearTimeout(hideTimer);flyout.style.display='flex';};const hide=()=>{hideTimer=setTimeout(()=>{if(!control.matches(':hover')&&!control.contains(document.activeElement))flyout.style.display='none';},280);};control.addEventListener('mouseenter',show);control.addEventListener('mouseleave',hide);control.addEventListener('focusin',show);control.addEventListener('focusout',hide);slider.addEventListener('input',()=>setVolume(slider.value));speaker.addEventListener('click',()=>{show();slider.focus();});setVolume(state.volume);

async function unlock(){if(state.unlocked)return;state.unlocked=true;const c=ensureFallback();if(c?.state==='suspended')await c.resume();syncMusic(state.room);}
window.addEventListener('orbital-room-state',event=>syncMusic(event.detail));
window.addEventListener('pointerdown',unlock,{once:true,capture:true});
window.addEventListener('keydown',unlock,{once:true,capture:true});
syncMusic(null);
