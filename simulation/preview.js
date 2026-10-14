import {ballisticPoint,createAimFlight,projectileMuzzle,traceFlight} from './collision.js';

export function simulateHuancavelicaV2Preview(room,player,angle,power,{isSolid,firstSolid}){
  const shot=projectileMuzzle(createAimFlight(player,angle,power,room.match?.wind?.signed??0),isSolid);
  const hit=traceFlight(shot,{players:room.players,ownerId:player.id,firstSolid});
  const dots=[];
  for(let t=.02;t<hit.seconds;t+=.12)dots.push(ballisticPoint(shot,t));
  return {dots,impact:{x:hit.x,y:hit.y,type:hit.type,targetPlayerId:hit.targetPlayerId}};
}
