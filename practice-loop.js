// Owns only practice input + one simulation RAF. Renderer/audio lifetimes are injected.
export function chargePower(elapsed,duration){return Math.round(10+90*Math.max(0,Math.min(1,elapsed/duration)));}
export function createPracticeLoop({session,target,clock,requestFrame,cancelFrame,onFrame,onReset=()=>{},onAction=()=>{},onShortcut=()=>{},disposeResources=()=>{}}){
 const abort=new AbortController(),held={KeyA:false,KeyD:false};let frameId=null,disposed=false,lastWalk=0,nextWalk=0,chargeStartedAt=null;
 const listen=(type,fn)=>target.addEventListener(type,fn,{signal:abort.signal});
 function stop(){held.KeyA=held.KeyD=false;chargeStartedAt=null;nextWalk=0;session.command('air_input',{direction:0},clock());}
 function updateCharge(){
  if(chargeStartedAt==null)return;
  const state=session.getState(),p=state.players[0];
  if(p.airborne||!p.alive||state.match.projectile){chargeStartedAt=null;return;}
  const power=chargePower(clock()-chargeStartedAt,session.profile.chargeMs);
  if(power!==state.match.aimPower)act('set_aim',{angle:state.match.aimAngle,power});
 }
 function act(event,payload={}){if(disposed)return{ok:false,error:'session_disposed'};if(event==='fire_projectile')stop();const result=session.command(event,payload,clock());onAction(result,event);return result;}
 function reset(profile){if(disposed)return false;stop();session.reset(clock(),profile);lastWalk=0;onReset();onFrame(session.getState());return true;}
 function down(e){
  if(e.ctrlKey||e.metaKey||e.altKey||['INPUT','SELECT','TEXTAREA'].includes(e.target?.tagName))return;
  const code=e.code;if(!['KeyA','KeyD','KeyW','KeyS','KeyQ','KeyE','Space','KeyF','Digit1','Digit2','Digit3','KeyR','KeyT','KeyG','KeyM','KeyL'].includes(code))return;e.preventDefault();
  if(code==='KeyR'){if(!e.repeat)reset();return;}
  if(['KeyT','KeyG','KeyM','KeyL'].includes(code)){if(!e.repeat)onShortcut(code);return;}
  if(chargeStartedAt!=null)return;
  if(code==='KeyA'||code==='KeyD'){if(!e.repeat){held[code]=true;act('air_input',{direction:Number(held.KeyD)-Number(held.KeyA)});}return;}
  if(e.repeat)return;
  if(code.startsWith('Digit')){act('select_item',{slot:Number(code.slice(-1))});return;}
  if(code==='Space')act('jump_player');else if(code==='KeyF'){
   const state=session.getState(),p=state.players[0];
   if(session.profile.chargeMs&&!p.airborne&&p.alive&&!state.match.projectile&&(p.selectedItemSlot??1)===1){stop();chargeStartedAt=clock();act('set_aim',{angle:state.match.aimAngle,power:10});}
   else act('fire_projectile');
  }
  else{const m=session.getState().match;act('set_aim',{angle:m.aimAngle+(code==='KeyW'?3:code==='KeyS'?-3:0),power:m.aimPower+(code==='KeyE'?5:code==='KeyQ'?-5:0)});}
 }
 function up(e){
  if(e.code==='KeyF'&&chargeStartedAt!=null){
   if(e.ctrlKey||e.metaKey||e.altKey||['INPUT','SELECT','TEXTAREA'].includes(e.target?.tagName)){stop();return;}
   updateCharge();if(chargeStartedAt!=null){chargeStartedAt=null;act('fire_projectile');}
  }
  if(e.code==='KeyA'||e.code==='KeyD'){held[e.code]=false;act('air_input',{direction:Number(held.KeyD)-Number(held.KeyA)});if(!held.KeyA&&!held.KeyD)nextWalk=0;}
 }
 function frame(){
  if(disposed)return;const now=clock(),direction=Number(held.KeyD)-Number(held.KeyA),s=session.getState(),p=s.players[0];
  updateCharge();
  if(direction&&!p.airborne&&!s.match.projectile&&p.alive){
   if(session.profile.id==='legacy'){if(now-lastWalk>=70){lastWalk=now;act('move_player',{direction});}}
   else{
    if(!nextWalk)nextWalk=now;
    let steps=0;while(now>=nextWalk&&steps++<5){act('move_player',{direction});nextWalk+=session.profile.walkEveryMs;if(session.getState().players[0].airborne)break;}
    if(steps>5)nextWalk=now+session.profile.walkEveryMs;
   }
  }else nextWalk=0;
  session.tick(now);onFrame(session.getState());frameId=requestFrame(frame);
 }
 listen('keydown',down);listen('keyup',up);listen('blur',stop);
 frameId=requestFrame(frame);
 return Object.freeze({act,stop,
  reset,
  dispose(){if(disposed)return;disposed=true;if(frameId!=null)cancelFrame(frameId);frameId=null;abort.abort();session.dispose();disposeResources();},
  get charging(){return chargeStartedAt!=null;},get disposed(){return disposed;},get activeFrames(){return frameId==null?0:1;}});
}
