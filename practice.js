import {THEMED_BITMAP_MAPS} from './simulation/themed-maps.js?v=bitmap-maps-1';
import {loadBrowserTerrainMask} from './simulation/browser-mask.js?v=bitmap-maps-1';
import {createPracticeSession} from './simulation/practice.js?v=contact-fix-20261025';
import {createPracticeLoop} from './practice-loop.js?v=desktop-clean-20261024';
import {createPracticeAudio} from './practice-audio.js?v=feel11-20261024';
import {createRenderer} from './renderer10-huancavelica.js?v=feel11-20261024&look=pickup-spin-20261025';
import {mountAppearancePicker} from './appearance-picker.js?v=english-release-20261025';
import {drawWeaponIcon} from './weapon-art.js?v=pickup-spin-20261025';
const $=id=>document.getElementById(id),canvas=$('gameCanvas'),message=$('practiceMessage'),abort=new AbortController();
const names={basic:'Basic',heavy:'Heavy Bomb',triple:'Triple Shot',cluster:'Cluster Bomb',airstrike:'Air Strike',nuke:'Nuke Laser',shield:'Shield',heal:'Heal +20'};
const errors={player_airborne:'Land first.',already_airborne:'Already airborne.',shot_in_flight:'Shot in flight.',heal_full_hp:'HP full.',arena_budget_reset_required:'Arena full · R reset.',player_missing:'Out · G recover.',not_grounded:'No ground.'};
let loop=null,session=null,renderer=null,audio=null,closed=false,lastUiAt=0,messageUntil=0;
let iconType=null;
const clock=()=>Date.now();
const appearancePicker=mountAppearancePicker($('practiceAppearance'),{compact:true,signal:abort.signal,onChange:()=>{canvas.focus();}});
function displayState(state){
 return {...state,players:state.players.map(player=>({...player,appearance:player.id==='local'?appearancePicker.getValue():{animal:'fox',cart:'tico'}}))};
}
function say(text){message.textContent=text;messageUntil=clock()+3500;}
function close(){
 if(closed)return;closed=true;abort.abort();
 if(loop)loop.dispose();else{session?.dispose();renderer?.destroy();audio?.destroy();}
 loop=session=renderer=audio=null;
}
function ui(state){
 const p=state.players[0],dummy=state.players[1],q=state.match.projectile,slot=p.selectedItemSlot??1;
 $('playerHp').textContent=p.hp;$('dummyHp').textContent=dummy.hp;
 $('practiceStatus').textContent=q?'In flight':!p.alive?'Out · G':p.airborne?'Airborne':loop?.charging?'Charging':'Ready';
 const equipped=q?.weaponType??(slot>1?p.inventory[slot-2]?.type:'basic');$('equippedWeapon').textContent=names[equipped]??'Empty';
 if(equipped!==iconType){iconType=equipped;drawWeaponIcon($('equippedIcon'),equipped).catch(error=>console.error('[Arsenal]',error.message));}
 $('inventoryInfo').textContent=['1 Basic',...p.inventory.map((item,index)=>(index+2)+' '+(names[item?.type]??'—'))].map((text,index)=>index+1===slot?'['+text+']':text).join(' · ');
 $('practiceAngle').value=state.match.aimAngle;$('angleValue').textContent=state.match.aimAngle+'°';
 $('practicePower').value=state.match.aimPower;$('powerValue').textContent=state.match.aimPower+'%';
 $('practiceWeapon').disabled=Boolean(q);
 for(const id of ['practiceAngle','practicePower'])$(id).disabled=Boolean(q||p.airborne||!p.alive);
 $('fireHint').textContent=session.profile.chargeMs&&slot===1?'hold / release':'press';
 if(message.textContent&&clock()>messageUntil)message.textContent='';
}
function equip(){const result=session.equip($('practiceWeapon').value,clock());say(result.ok?(names[$('practiceWeapon').value]??'Weapon')+' equipped.':errors[result.error]??'Unavailable.');}
function shortcut(code){
 if(code!=='KeyM')loop.stop();
 if(code==='KeyT')say(session.resetDummy()?'Target reset.':'No ground · R reset.');
 else if(code==='KeyG')say(session.recoverPlayer()?'Recovered.':'No ground · R reset.');
 else if(code==='KeyM')say(audio.toggle()?'Sound off.':'Sound on.');
 else if(code==='KeyL')equip();
}
async function start(){
 try{
  const requestedMap=new URLSearchParams(location.search).get('map'),mapId=THEMED_BITMAP_MAPS[requestedMap]?requestedMap:'huancavelica-v2';
  $('practiceMap').value=mapId;const mapName=THEMED_BITMAP_MAPS[mapId]?.name??'Huancavelica';document.title=mapName+' — Carabayllo Secret Wars';canvas.setAttribute('aria-label',canvas.getAttribute('aria-label').replace(/^Huancavelica/,mapName));
  $('practiceMap').addEventListener('change',()=>{const url=new URL(location.href);url.searchParams.set('map',$('practiceMap').value);location.href=url.href;},{signal:abort.signal});
  const mask=await loadBrowserTerrainMask(mapId);if(closed)return;
  const profile=new URLSearchParams(location.search).get('profile')==='legacy'?'legacy':'reference-v1';
  session=createPracticeSession(mask,{now:clock(),profile,mapId});audio=createPracticeAudio(window);renderer=createRenderer(canvas,{internalWidth:1600,internalHeight:900});
  loop=createPracticeLoop({session,target:window,clock,requestFrame:fn=>requestAnimationFrame(fn),cancelFrame:id=>cancelAnimationFrame(id),
   onFrame:state=>{renderer.drawArena(displayState(state),'local');if(clock()-lastUiAt>=80){lastUiAt=clock();ui(state);}},
   onReset:()=>{renderer.destroy();audio.stop();renderer=createRenderer(canvas,{internalWidth:1600,internalHeight:900});$('practiceWeapon').value='basic';say('Arena reset.');},
   onAction:result=>{if(!result.ok)say(errors[result.error]??'Unavailable.');},onShortcut:shortcut,
   disposeResources:()=>{renderer.destroy();audio.destroy();}});
  $('practiceWeapon').addEventListener('change',()=>{equip();$('practiceWeapon').blur();canvas.focus();},{signal:abort.signal});
  for(const id of ['practiceAngle','practicePower'])$(id).addEventListener('input',()=>loop.act('set_aim',{angle:Number($('practiceAngle').value),power:Number($('practicePower').value)}),{signal:abort.signal});
  document.addEventListener('visibilitychange',()=>loop?.stop(),{signal:abort.signal});
  ui(session.getState());say('Ready.');canvas.focus();
 }catch(error){say('Could not load · '+error.message);close();}
}
window.addEventListener('pagehide',close,{once:true});
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
$('exitPractice').addEventListener('click',close,{once:true});
start();
