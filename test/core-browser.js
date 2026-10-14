import {loadBrowserTerrainMask} from '../simulation/browser-mask.js';
import {runCoreScenario} from './core-scenario.js';
document.getElementById('run').addEventListener('click',async()=>{
 const result=document.getElementById('result');result.textContent='Running actual shared modules…';
 try{
  const mask=await loadBrowserTerrainMask(),cases=runCoreScenario(mask);
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(cases)));
  const digest=Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
  const summary=cases.map(c=>({case:c.type,cuts:c.state.arena.craters.length,hp:c.state.players.map(p=>p.hp),events:c.state.events.length,active:c.state.match.activePlayerId}));
  result.textContent=(digest==='c50546629d5cd0351d2cf60072f592a96bd59053ae7a55f8febb3d23eee36377'?'PASS':'FAIL')+' — Node ↔ Chromium, tolerance1e-6 world\n'+digest+'\n'+JSON.stringify(summary,null,2);
 }catch(e){result.textContent='FAIL '+e.message;}
});
