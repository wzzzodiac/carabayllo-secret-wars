// Owns only practice input + one simulation RAF. Renderer/audio lifetimes are injected.
export function createPracticeLoop({session,target,clock,requestFrame,cancelFrame,onFrame,onReset=()=>{},onAction=()=>{},disposeResources=()=>{}}){
 const abort=new AbortController(),held={KeyA:false,KeyD:false};let frameId=null,disposed=false,lastWalk=0;
 const listen=(type,fn)=>target.addEventListener(type,fn,{signal:abort.signal});
 function stop(){held.KeyA=held.KeyD=false;session.command('air_input',{direction:0},clock());}
 function act(event,payload={}){if(disposed)return{ok:false,error:'session_disposed'};if(event==='fire_projectile')stop();const result=session.command(event,payload,clock());onAction(result,event);return result;}
 function down(e){
  if(e.ctrlKey||e.metaKey||e.altKey||['INPUT','SELECT','TEXTAREA'].includes(e.target?.tagName))return;
  const code=e.code;if(!['KeyA','KeyD','KeyW','KeyS','KeyQ','KeyE','Space','KeyF'].includes(code))return;e.preventDefault();
  if(code==='KeyA'||code==='KeyD'){if(!e.repeat){held[code]=true;act('air_input',{direction:Number(held.KeyD)-Number(held.KeyA)});}return;}
  if(e.repeat)return;
  if(code==='Space')act('jump_player');else if(code==='KeyF')act('fire_projectile');
  else{const m=session.getState().match;act('set_aim',{angle:m.aimAngle+(code==='KeyW'?3:code==='KeyS'?-3:0),power:m.aimPower+(code==='KeyE'?5:code==='KeyQ'?-5:0)});}
 }
 function up(e){if(e.code==='KeyA'||e.code==='KeyD'){held[e.code]=false;act('air_input',{direction:Number(held.KeyD)-Number(held.KeyA)});}}
 function frame(){
  if(disposed)return;const now=clock(),direction=Number(held.KeyD)-Number(held.KeyA),s=session.getState(),p=s.players[0];
  if(direction&&!p.airborne&&!s.match.projectile&&p.alive&&now-lastWalk>=70){lastWalk=now;act('move_player',{direction});}
  session.tick(now);onFrame(session.getState());frameId=requestFrame(frame);
 }
 listen('keydown',down);listen('keyup',up);listen('blur',stop);
 frameId=requestFrame(frame);
 return Object.freeze({act,stop,
  reset(){if(disposed)return false;stop();session.reset(clock());lastWalk=0;onReset();onFrame(session.getState());return true;},
  dispose(){if(disposed)return;disposed=true;if(frameId!=null)cancelFrame(frameId);frameId=null;abort.abort();session.dispose();disposeResources();},
  get disposed(){return disposed;},get activeFrames(){return frameId==null?0:1;}});
}
