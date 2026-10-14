import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createPracticeSession} from '../simulation/practice.js';
import {createPracticeLoop} from '../practice-loop.js';
import {vehiclePose,VEHICLE_BODY} from '../simulation/vehicle-pose.js';
import {createPracticeAudio} from '../practice-audio.js';
export function runPracticeRegressions(mask){
 let now=1000000,counter=0,cleanups=0,paints=0;const callbacks=new Map(),target=new EventTarget();
 const requestFrame=fn=>{const id=++counter;callbacks.set(id,fn);return id;},cancelFrame=id=>callbacks.delete(id);
 const key=(type,code,repeat=false)=>{const event=new Event(type,{cancelable:true});Object.assign(event,{code,repeat});target.dispatchEvent(event);};
 for(let pass=0;pass<25;pass++){
  const session=createPracticeSession(mask,{now}),initial=session.getState(),dummy={...initial.players[1].spawn};
  const loop=createPracticeLoop({session,target,clock:()=>now,requestFrame,cancelFrame,onFrame:()=>paints++,disposeResources:()=>cleanups++});
  assert.equal(callbacks.size,1);key('keydown','Space');key('keydown','KeyD');for(let i=0;i<30;i++)key('keydown','KeyD',true);key('keyup','KeyD');
  for(let i=0;i<200;i++){now+=20;const entry=callbacks.entries().next().value;callbacks.delete(entry[0]);entry[1]();}
  assert.equal(callbacks.size,1);assert.equal(session.getState().players[0].airborne,null);assert.deepEqual(session.getState().players[1].spawn,dummy);
  loop.reset();assert.deepEqual(session.getState().players,initial.players);assert.equal(callbacks.size,1);
  const pending=[...callbacks.values()];loop.dispose();loop.dispose();assert.equal(callbacks.size,0);assert.equal(loop.activeFrames,0);assert.equal(session.getState(),null);const before=paints;
  for(const callback of pending)callback();key('keydown','Space');assert.equal(paints,before,'disposed callback and key listeners cannot act');
 }
 assert.equal(cleanups,25);
 // Execute the actual four-layer renderer chain with recording Canvas/RAF adapters.
 const overlays=new Set(),events=new Map(),frames=new Map();let frame=0;
 const noop=()=>{},gradient={addColorStop:noop};
 class Canvas{
  constructor(){this.width=1600;this.height=900;this.style={};this.parentElement={appendChild:c=>overlays.add(c)};this.context=new Proxy({createLinearGradient:()=>gradient,measureText:()=>({width:10})},{get:(o,k)=>o[k]??noop,set:(o,k,v)=>(o[k]=v,true)});}
  getContext(){return this.context;}setAttribute(){}remove(){overlays.delete(this);}
  addEventListener(t,f){if(!events.has(t))events.set(t,new Set());events.get(t).add(f);}removeEventListener(t,f){events.get(t)?.delete(f);if(!events.get(t)?.size)events.delete(t);}
 }
 const sandbox={HTMLCanvasElement:Canvas,document:{createElement:()=>new Canvas()},window:{dispatchEvent:noop},Date,Math,Map,Set,Object,performance:{now:()=>now},
  requestAnimationFrame:fn=>{frames.set(++frame,fn);return frame;},cancelAnimationFrame:id=>frames.delete(id),
  createHuancavelicaPainter:()=>({}),createHuancavelicaV2Painter:()=>({}),vehiclePose,VEHICLE_BODY,isHuancavelicaV2Room:()=>true};
 const factory=file=>vm.runInNewContext(readFileSync(new URL('../'+file,import.meta.url),'utf8').replace(/^import .*;\r?$/gm,'').replace('export function createRenderer','function createRenderer')+'\ncreateRenderer;',sandbox);
 const base=factory('renderer.js');sandbox.createBaseRenderer=base;
 const sixD=factory('renderer6d.js');sandbox.createPhase6dRenderer=sixD;
 const sixF=factory('renderer6f.js');sandbox.createPhase6fRenderer=sixF;
 const visual=factory('renderer7a-visual.js');
 for(let i=0;i<20;i++){
  const renderer=visual(new Canvas(),{internalWidth:1600,internalHeight:900});
  renderer.drawArena({status:'started',arena:{worldWidth:5000,worldHeight:3750},players:[{id:'local',spawn:{x:500,y:1300}}],match:{activePlayerId:'local'}},'local');
  assert.equal(overlays.size,3);assert.equal(frames.size,4);assert.equal(events.size,7);
  renderer.destroy();assert.equal(overlays.size,0);assert.equal(frames.size,0);assert.equal(events.size,0);
 }
 console.log('G09 practice25 lifecycles / actual renderer20 destroy chains: PASS');
 const originalAudio=globalThis.Audio,originalStorage=globalThis.localStorage;let audioCreated=0,audioPlays=0;
 try{
  globalThis.Audio=class{constructor(){audioCreated++;}pause(){}play(){audioPlays++;return Promise.resolve();}removeAttribute(){}load(){}};
  globalThis.localStorage={getItem:()=>72};const audioTarget=new EventTarget(),sound=createPracticeAudio(audioTarget);
  for(let i=0;i<600;i++){const event=new Event('orbital-visual-sfx');event.detail={name:'basic',key:'shot'+i};audioTarget.dispatchEvent(event);}
  assert.equal(audioCreated,4);assert.equal(sound.voiceCount,4);assert.equal(audioPlays,600);
  sound.stop();sound.destroy();const event=new Event('orbital-visual-sfx');event.detail={name:'basic',key:'after'};audioTarget.dispatchEvent(event);assert.equal(audioPlays,600);
 }finally{globalThis.Audio=originalAudio;globalThis.localStorage=originalStorage;}
 console.log('G09 audio4 voices / 600 events / detached disposal: PASS');
}
