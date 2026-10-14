import {loadBrowserTerrainMask} from './simulation/browser-mask.js';
import {createPracticeSession,PRACTICE_LIMITS} from './simulation/practice.js';
import {createPracticeLoop} from './practice-loop.js';
import {createPracticeAudio} from './practice-audio.js';
import {SIMULATION_REVISION} from './simulation/collision.js';
import {createRenderer} from './renderer10-huancavelica.js?v=huancavelica-v2-bitmap-1';
const $=id=>document.getElementById(id),canvas=$('gameCanvas'),message=$('practiceMessage'),abort=new AbortController();
let loop=null,session=null,renderer=null,audio=null,closed=false,lastUiAt=0;
const clock=()=>Date.now();
function say(text){message.textContent=text;}
function close(){
 if(closed)return;closed=true;abort.abort();
 if(loop)loop.dispose();else{session?.dispose();renderer?.destroy();audio?.destroy();}
 loop=session=renderer=audio=null;
}
const errors={player_airborne:'Land before aiming, firing or jumping again.',already_airborne:'Land before jumping again.',shot_in_flight:'Wait for this attack to settle.',heal_full_hp:'HP is full. Save Heal for later.',arena_budget_reset_required:'Arena budget reached. RESET ARENA to keep playing.',player_missing:'Vehicle eliminated. RECOVER PLAYER or RESET ARENA.',not_grounded:'No support: let the vehicle fall.'};
function ui(state){
 const p=state.players[0],dummy=state.players[1],q=state.match.projectile;
 $('playerHp').textContent=p.hp+' HP';$('dummyHp').textContent=dummy.hp+' HP';
 $('practiceStatus').textContent=q?'ATTACK RESOLVING':!p.alive?'RECOVER YOUR VEHICLE':p.airborne?'AIRBORNE / A D TO STEER':'FREE PRACTICE / YOUR CONTROL';
 $('damageFeedback').textContent=dummy.lastDamage?'DUMMY −'+dummy.lastDamage.amount+' HP / '+(dummy.alive?'reset anytime after the attack':'ELIMINATED — RESET DUMMY'):'Dummy never acts or gets a turn.';
 $('inventoryInfo').textContent='Selected: '+(p.selectedItemSlot>1?p.inventory[p.selectedItemSlot-2]?.label??'EMPTY':'BASIC')+' / Inventory: '+p.inventory.map(x=>x?.label??'empty').join(' / ');
 $('practiceAngle').value=state.match.aimAngle;$('angleValue').textContent=state.match.aimAngle+'°';
 $('practicePower').value=state.match.aimPower;$('powerValue').textContent=state.match.aimPower+'%';
 for(const id of ['resetDummy','recoverPlayer','practiceWeapon','equipPracticeWeapon'])$(id).disabled=Boolean(q);
 for(const id of ['practiceAngle','practicePower','practiceJump','practiceFire'])$(id).disabled=Boolean(q||p.airborne||!p.alive);
 $('practiceSlot2').textContent='2 '+(p.inventory[0]?.label??'EMPTY');$('practiceSlot3').textContent='3 '+(p.inventory[1]?.label??'EMPTY');
 $('practiceSlot2').disabled=Boolean(q||!p.inventory[0]);$('practiceSlot3').disabled=Boolean(q||!p.inventory[1]);
 $('practiceDiagnostics').textContent='Local simulation / no multiplayer transport\nControllable players: 1 / dummy turns: 0\nAttacks '+state.attacks+'/'+PRACTICE_LIMITS.attacks+' / cuts '+state.arena.craters.length+'/'+PRACTICE_LIMITS.hardCraterBudget+'\nPickups '+state.pickups.length+'/'+PRACTICE_LIMITS.pickups+' / events '+state.events.length+'/'+PRACTICE_LIMITS.events+'\nSession simulation RAF: '+loop?.activeFrames+' / audio voices: '+audio.voiceCount+'\nTurn owner: '+state.match.activePlayerId+' / turn: '+state.match.turnNumber;
 $('practiceDiagnostics').textContent+='\nCore: '+SIMULATION_REVISION+' / anchored dummy: '+dummy.dummy+(q?'\nPending contacts: '+(q.impacts?.filter(e=>!e.resolved).length??1)+' / remaining: '+Math.max(0,Math.round(q.resolveAt-clock()))+'ms':'');
}
function listen(id,type,fn){$(id).addEventListener(type,fn,{signal:abort.signal});}
async function start(){
 try{
  const mask=await loadBrowserTerrainMask();if(closed)return;
  session=createPracticeSession(mask,{now:clock()});audio=createPracticeAudio(window);renderer=createRenderer(canvas,{internalWidth:1600,internalHeight:900});
  loop=createPracticeLoop({session,target:window,clock,requestFrame:fn=>requestAnimationFrame(fn),cancelFrame:id=>cancelAnimationFrame(id),
   onFrame:state=>{renderer.drawArena(state,'local');if(clock()-lastUiAt>=80){lastUiAt=clock();ui(state);}},
   onReset:()=>{renderer.destroy();audio.stop();renderer=createRenderer(canvas,{internalWidth:1600,internalHeight:900});$('practiceWeapon').value='basic';say('Arena restored. Same approved art, fresh terrain and dummy.');},
   onAction:(result,event)=>{if(!result.ok)say(errors[result.error]??result.error??'Action blocked.');else if(event==='fire_projectile')say('Attack accepted locally. Practice continues after it settles.');},
   disposeResources:()=>{renderer.destroy();audio.destroy();}});
  listen('resetArena','click',()=>{loop.reset();canvas.focus();});
  listen('resetDummy','click',()=>{session.resetDummy();say('Dummy restored to100 HP.');canvas.focus();});
  listen('recoverPlayer','click',()=>{say(session.recoverPlayer()?'Vehicle recovered on remaining terrain.':'No safe recovery: RESET ARENA.');canvas.focus();});
  listen('practiceSound','click',()=>{$('practiceSound').textContent=audio.toggle()?'SOUND OFF':'SOUND ON';canvas.focus();});
  listen('practiceWeapon','change',()=>{const result=session.equip($('practiceWeapon').value,clock());say(result.ok?'Loadout equipped. Pickup inventory and consumption remain real.':errors[result.error]??result.error);$('practiceWeapon').blur();canvas.focus();});
  listen('equipPracticeWeapon','click',()=>{const result=session.equip($('practiceWeapon').value,clock());say(result.ok?'Loadout re-equipped. Carried items still consume normally.':errors[result.error]??result.error);canvas.focus();});
  for(const [id,event]of[['practiceJump','jump_player'],['practiceFire','fire_projectile']])listen(id,'click',()=>{loop.act(event);canvas.focus();});
  for(const [id,slot]of[['practiceSlot1',1],['practiceSlot2',2],['practiceSlot3',3]])listen(id,'click',()=>{loop.act('select_item',{slot});canvas.focus();});
  for(const id of ['practiceAngle','practicePower'])listen(id,'input',()=>loop.act('set_aim',{angle:Number($('practiceAngle').value),power:Number($('practicePower').value)}));
  document.addEventListener('visibilitychange',()=>loop?.stop(),{signal:abort.signal});
  ui(session.getState());say('Ready — offline. A/D move, SPACE jump, F fire. All weapons in LOADOUT.');canvas.focus();
 }catch(error){say('Practice could not load: '+error.message);close();}
}
window.addEventListener('pagehide',close,{once:true});
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
$('exitPractice').addEventListener('click',close,{once:true});
start();
