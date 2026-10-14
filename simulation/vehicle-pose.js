import {VEHICLE_BODY} from './collision.js';
export {VEHICLE_BODY};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t;
export function vehiclePose(player,now=Date.now()){
  if(!player?.spawn)return null;
  const p=player.presentation;
  if(!p)return player.spawn;
  const t=clamp((now-p.startedAt)/Math.max(1,p.endsAt-p.startedAt),0,1);
  return {...player.spawn,x:lerp(p.fromX,p.toX,t),y:lerp(p.fromY,p.toY,t)};
}
export function nextVehiclePresentation(previous,spawn,now){
  if(previous&&previous.toX===spawn.x&&previous.toY===spawn.y)return previous;
  const from=previous?vehiclePose({spawn,presentation:previous},now):spawn;
  const span=previous?clamp(now-previous.receivedAt,35,100):1;
  return{fromX:from.x,fromY:from.y,toX:spawn.x,toY:spawn.y,startedAt:now,endsAt:now+span,receivedAt:now};
}
