import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodeRgbaPng} from './frontend-source-regressions.mjs';
import {THEMED_BITMAP_MAPS} from '../simulation/themed-maps.js';
import {createBitmapTerrain} from '../simulation/terrain.js';
import {createPracticeSession} from '../simulation/practice.js';
export function runThemedBitmapRegressions(){
 let pixelsChecked=0;
 for(const map of Object.values(THEMED_BITMAP_MAPS)){
  const load=file=>decodeRgbaPng(readFileSync(new URL('../assets/map-themes/'+map.folder+'/'+file+'.png',import.meta.url)));
  const mask=load('mask'),art=load('terrain-bitmap'),bits=new Uint8Array(Math.ceil(1672*1672/8));
  assert.equal(mask.width,1672);assert.equal(mask.height,1672);assert.equal(art.width,1672);assert.equal(art.height,1672);
  for(let i=0;i<1672*1672;i++){
   const alpha=mask.pixels[i*4+3];assert.ok(alpha===0||alpha===255);assert.equal(art.pixels[i*4+3],alpha,'terrain/mask alpha identity');
   if(alpha)bits[i>>3]|=1<<(i&7);pixelsChecked++;
  }
  const authority=readFileSync(new URL('../../backend/assets/'+map.folder+'-terrain-mask.bin',import.meta.url));
  assert.equal(Buffer.compare(Buffer.from(bits),authority),0,'browser PNG and server packed mask must agree on EVERY pixel');
  const terrain=createBitmapTerrain(bits,map.geometry),room={arena:{craters:[]}},x=map.practiceXs[0],surface=terrain.findHuancavelicaV2SurfaceBelow(room,x,0,5000);
  assert.ok(surface!=null);room.arena.craters.push({x,y:surface+300,radius:80});
  assert.equal(terrain.isHuancavelicaV2Solid(room,x,surface+300),false);assert.equal(terrain.isHuancavelicaV2Solid(room,x,surface+20),true,'an underground tunnel preserves its roof');
  const practice=createPracticeSession(bits,{mapId:map.id,profile:'reference-v1',now:0});
  assert.equal(practice.getState().arena.terrainRevision,map.revision);assert.ok(practice.getState().players.every(p=>p.spawn));
  assert.equal(practice.command('jump_player',{},0).ok,true);for(let now=20;now<=3000;now+=20)practice.tick(now);
  assert.equal(practice.getState().players[0].airborne,null);practice.reset(3000);assert.equal(practice.getState().arena.craters.length,0);practice.dispose();
 }
 console.log('Playable map masks: '+pixelsChecked+' exact art/PNG/server pixels / shared jump, tunnels and reset: PASS');
}
