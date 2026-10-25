import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPracticeSession} from '../simulation/practice.js';
import {createPracticeLoop} from '../practice-loop.js';

export function runDesktopUiRegressions(mask){
 const html=readFileSync(new URL('../practice.html',import.meta.url),'utf8');
 const controller=readFileSync(new URL('../practice.js',import.meta.url),'utf8');
 assert.doesNotMatch(html,/<button\b/i,'no on-screen action buttons');
 assert.doesNotMatch(html,/practice-help|feelMetrics|practiceDiagnostics|RESET ARENA|EQUIP LOADOUT/,'remove lab prose and action toolbar');
 const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
 for(const match of controller.matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.has(match[1]),'controller target exists: '+match[1]);
 const target=new EventTarget(),frames=new Map(),shortcuts=[];let id=0,resets=0;
 const session=createPracticeSession(mask,{profile:'reference-v1',now:100000});
 const loop=createPracticeLoop({session,target,clock:()=>100000,requestFrame:fn=>{frames.set(++id,fn);return id;},cancelFrame:i=>frames.delete(i),onFrame:()=>{},onReset:()=>resets++,onShortcut:code=>shortcuts.push(code)});
 const key=(code,repeat=false,extra={})=>{const e=new Event('keydown',{cancelable:true});Object.assign(e,{code,repeat,...extra});target.dispatchEvent(e);return e;};
 session.equip('heavy',100000);key('Digit1');assert.equal(session.getState().players[0].selectedItemSlot,1);
 key('Digit2');assert.equal(session.getState().players[0].selectedItemSlot,2);
 key('Digit3');assert.equal(session.getState().players[0].selectedItemSlot,2,'empty slots cannot be selected');
 for(const code of ['KeyT','KeyG','KeyM','KeyL']){key(code);key(code,true);}
 assert.deepEqual(shortcuts,['KeyT','KeyG','KeyM','KeyL'],'repeat never floods utility actions');
 key('Digit1');key('KeyF');assert.ok(loop.charging);key('KeyR');assert.equal(resets,1);assert.equal(loop.charging,false);
 const release=new Event('keyup');release.code='KeyF';target.dispatchEvent(release);assert.equal(session.getState().attacks,0,'reset cancels held charge');
 key('KeyR',true);key('KeyR',false,{ctrlKey:true});assert.equal(resets,1,'repeat and browser Ctrl+R are not intercepted');
 target.tagName='SELECT';key('KeyR');key('KeyF');assert.equal(resets,1);assert.equal(loop.charging,false,'form controls keep their keyboard input');delete target.tagName;
 assert.equal(frames.size,1);loop.dispose();key('KeyR');assert.equal(resets,1);assert.equal(frames.size,0);
 console.log('Desktop UI: no action buttons / DOM targets / slots / utility keys / reset and focus guards: PASS');
}
