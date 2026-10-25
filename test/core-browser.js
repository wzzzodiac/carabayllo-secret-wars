import {loadBrowserTerrainMask} from '../simulation/browser-mask.js';
import {runCoreScenario} from './core-scenario.js';
import {createPracticeSession} from '../simulation/practice.js?v=contact-fix-20261025';
import * as contract from '../simulation/collision.js';
import {runFeelLabScenario} from './feel-lab-scenario.js';
document.getElementById('run').addEventListener('click',async()=>{
 const result=document.getElementById('result');result.textContent='Running actual shared modules…';
 try{
  const mask=await loadBrowserTerrainMask(),cases=runCoreScenario(mask);
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(cases)));
  const digest=Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
  const summary=cases.map(c=>({case:c.type,cuts:c.state.arena.craters.length,hp:c.state.players.map(p=>p.hp),events:c.state.events.length,active:c.state.match.activePlayerId}));
  const practice=createPracticeSession(mask,{now:0});let now=0,trial=true;
  for(let shot=0;shot<4;shot++){practice.equip('triple',now);practice.command('fire_projectile',{},now);const start=now;while(practice.getState().match.projectile&&now-start<10000){now+=20;practice.tick(now);}trial&&=practice.getState().match.projectile===null;}
  const hp=practice.getState().players[1].hp;practice.dispose();
  const feel=runFeelLabScenario(mask);
  result.textContent=(digest==='58169e4bfa7e91a342eac12069fbac955e87d033ebe41f7e4fdf1198d9cd964b'&&trial&&hp===0?'PASS':'FAIL')+' — Node ↔ Chromium, tolerance1e-6 world\n'+digest+'\nRevision: '+contract.SIMULATION_REVISION+' / finishing Triple: '+trial+' / dummyHP: '+hp+'\n'+JSON.stringify(summary,null,2);
  result.textContent+='\nLOCAL FEEL LAB: '+JSON.stringify(feel,null,2);
 }catch(e){result.textContent='FAIL '+e.message;}
});
