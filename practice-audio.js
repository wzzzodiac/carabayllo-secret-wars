// Four reusable voices, no background timers, bounded deduplication, explicit disposal.
const assets={basic:'basic_shot',heavy:'heavy_bomb',airBegin:'air_strike_begin',nuke:'nuke',warning:'warning',shield:'shield',health:'health',basicExplosion:'basic_explosion',loudExplosion:'loud_explosion',nukeExplosion:'nuke_explosion'};
export function createPracticeAudio(target){
 const voices=Array.from({length:4},()=>new Audio()),seen=new Set(),abort=new AbortController();let cursor=0,muted=false;
 function stop(){for(const v of voices){v.pause();try{v.currentTime=0;}catch{}}seen.clear();}
 target.addEventListener('orbital-visual-sfx',event=>{
  const d=event.detail;if(muted||!assets[d?.name]||seen.has(d.key))return;
  if(seen.size>=256)seen.delete(seen.values().next().value);seen.add(d.key);
  const voice=voices[cursor++%voices.length];voice.pause();voice.src=new URL('./assets/music/'+assets[d.name]+'.mp3',import.meta.url).href;
  voice.volume=Math.max(0,Math.min(1,Number(localStorage.getItem('orbital-artillery-master-volume')??72)/100*.9));voice.play().catch(()=>{});
 },{signal:abort.signal});
 return Object.freeze({stop,toggle(){muted=!muted;if(muted)stop();return muted;},destroy(){abort.abort();stop();for(const v of voices){v.removeAttribute('src');v.load();}},get voiceCount(){return voices.length;}});
}
