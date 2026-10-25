import {createPracticeSession} from '../simulation/practice.js';
import {createGameplayCore} from '../simulation/core.js';
import {createBitmapTerrain,HUANCAVELICA_V2_SCALE as scale} from '../simulation/terrain.js';
import {createAirbornePhysics} from '../simulation/airborne.js';
import {PRACTICE_PROFILES} from '../simulation/practice-profiles.js';
import {createPracticeLoop,chargePower} from '../practice-loop.js';
import {airStrikeCameraView} from '../airstrike-camera.js';

// The same scenarios execute in Node and the actual browser, on the approved mask.
export function runFeelLabScenario(mask){
 let assertions=0;
 const check=(condition,message)=>{assertions++;if(!condition)throw new Error(message);};
 const near=(a,b,tolerance=.00001)=>Math.abs(a-b)<=tolerance;
 const summary={shots:[],jumps:[],movement:[],routes:[]};
 const session=(profile)=>createPracticeSession(mask,{profile,now:100000});
 function jump(profile,dt=10){
  const s=session(profile);check(s.command('jump_player',{},100000).ok,'jump grounded '+profile);
  check(!s.command('jump_player',{},100001).ok,'no double jump '+profile);
  check(!s.command('fire_projectile',{},100001).ok,'no airborne shot '+profile);
  let now=100000;while(s.getState().players[0].airborne&&now<106000){now+=dt;s.tick(now);}
  const r=s.getState(),j=r.practiceMetrics.jump;
  check(r.players[0].alive&&j.landed,'land on authored island '+profile);
  check(r.arena.craters.length===0,'jump never changes terrain');s.dispose();return j;
 }
 for(const [angle,power]of[[5,10],[30,25],[45,55],[70,80],[85,100]]){
  const sessions=['legacy','reference-v1'].map(session);
  for(const s of sessions){s.command('set_aim',{angle,power},100000);check(s.command('fire_projectile',{},100000).ok,'accept basic');}
  const [oldShot,newShot]=sessions.map(s=>s.getState().match.projectile);
  check(near(oldShot.impactX,newShot.impactX)&&near(oldShot.impactY,newShot.impactY),'A/B keeps exact contact');
  check(oldShot.impactReason===newShot.impactReason&&oldShot.hitPlayerId===newShot.hitPlayerId,'A/B target parity');
  check(newShot.collisionTimeScale===1,'physical time scale is one');
  check(newShot.startedAt===100090&&oldShot.startedAt===100567,'launch latency bounded');
  check(newShot.durationMs<=oldShot.durationMs+.001,'physical time never adds slow motion');
  if(angle===5){
   check(newShot.durationMs<500&&oldShot.durationMs>=3999,'close shot is not stretched');
   for(const s of sessions){let now=100000;while(s.getState().match.projectile&&now<130000){now+=10;s.tick(now);}check(s.getState().match.projectile===null,'attack completes');}
   const [oldState,newState]=sessions.map(s=>s.getState());
   check(newState.players[1].hp===90&&oldState.players[1].hp===90,'same ten damage');
   check(newState.arena.craters.length===1&&oldState.arena.craters.length===1,'one real crater each');
   check(near(oldState.arena.craters[0].x,newState.arena.craters[0].x)&&oldState.arena.craters[0].y===newState.arena.craters[0].y,'same crater geometry');
   check(newState.players[1].dummy&&newState.match.activePlayerId==='local','dummy remains a training target and never acts');
  }
  summary.shots.push({angle,power,legacyMs:Math.round(oldShot.durationMs),referenceMs:Math.round(newShot.durationMs),contact:newShot.impactReason});
  sessions.forEach(s=>s.dispose());
 }
 const legacy=jump('legacy'),reference=jump('reference-v1');
 check(reference.airtimeMs>=1180&&reference.airtimeMs<=1280,'heavier reference airtime');
 check(reference.height>=480&&reference.height<=500,'shorter reference jump');
 check(legacy.airtimeMs>3300&&legacy.height>750,'legacy baseline preserved');
 summary.jumps.push({profile:'legacy',...legacy},{profile:'reference-v1',...reference});
 for(const dt of [1000/30,1000/60,1000/120]){
  const j=jump('reference-v1',dt);check(Math.abs(j.height-reference.height)<=6,'jump height stable across display rates');
  check(Math.abs(j.airtimeMs-reference.airtimeMs)<=45,'airtime stable across display rates');
 }
 // The online core ignores offline tuning even when supplied by a caller.
 {
  const s=session('legacy'),room=s.getState();delete room.practice;room.match.turnEndsAt=140000;
  const core=createGameplayCore(mask,{tuning:PRACTICE_PROFILES['reference-v1']});
  check(core.command(room,'local','fire_projectile',{},100000).ok,'default core accepts shot');
  check(room.match.projectile.durationMs>=3999&&room.match.projectile.startedAt===100567,'online/default ignores tuning');s.dispose();
 }
 // Specials keep their original timing, path, damage settings and preparation.
 for(const type of ['heavy','triple','cluster','airstrike','nuke']){
  const pair=['legacy','reference-v1'].map(session);
  for(const s of pair){s.equip(type,100000);s.command('fire_projectile',{},100000);}
  check(JSON.stringify(pair[0].getState().match.projectile)===JSON.stringify(pair[1].getState().match.projectile),'special unchanged '+type);pair.forEach(s=>s.dispose());
 }
 // Isolated collision fixtures, not replacement production terrain.
 function fixture(rects){
  const bits=new Uint8Array(Math.ceil(1448*1086/8));
  for(const [x0,y0,x1,y1]of rects)for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=y*1448+x;bits[i>>3]|=1<<(i&7);}
  return createAirbornePhysics(createBitmapTerrain(bits),PRACTICE_PROFILES['reference-v1'].air);
 }
 for(const obstacle of ['ceiling','wall']){
  const physics=fixture([[0,700,1448,1086],...(obstacle==='ceiling'?[[100,560,300,570]]:[[360,400,370,700]])]);
  const p={alive:true,hp:100,spawn:{x:(obstacle==='ceiling'?200:300)*scale,y:700*scale-8,facing:1}},room={arena:{craters:[]}};
  physics.setV2AirInput(p,obstacle==='wall'?1:0);physics.startV2Airborne(p,0,{jump:true});
  let minY=p.spawn.y,maxX=p.spawn.x;
  for(let t=10;t<=4000&&p.airborne;t+=10){physics.advanceV2AirbornePlayer(room,p,t);minY=Math.min(minY,p.spawn.y);maxX=Math.max(maxX,p.spawn.x);}
  check(p.alive&&!p.airborne,'settles after '+obstacle);
  if(obstacle==='ceiling')check(minY-59>=570*scale-2,'head cannot tunnel through ceiling');
  else check(maxX+45<360*scale+2,'body cannot tunnel through wall');
 }
 // Velocity: releasing coasts; opposite input brakes before reversing.
 {
  const physics=fixture([[0,1000,1448,1086]]),room={arena:{craters:[]}};
  const make=()=>({alive:true,hp:100,spawn:{x:1000,y:1500,facing:1},airborne:{vx:400,vy:-300,input:0,updatedAt:0,startedAt:0}});
  const coast=make(),brake=make();brake.airborne.input=-1;
  physics.advanceV2AirbornePlayer(room,coast,50);physics.advanceV2AirbornePlayer(room,brake,50);
  check(coast.airborne.vx>0&&coast.airborne.vx<400,'release does not snap velocity to zero');
  check(brake.airborne.vx>=0&&brake.airborne.vx<coast.airborne.vx,'countersteer brakes continuously');
  physics.advanceV2AirbornePlayer(room,brake,250);check(brake.airborne.vx<0,'countersteer can reverse');
 }
 function inputHarness(){
  let now=100000,id=0;const callbacks=new Map(),target=new EventTarget(),s=session('reference-v1');
  const loop=createPracticeLoop({session:s,target,clock:()=>now,requestFrame:fn=>{callbacks.set(++id,fn);return id;},cancelFrame:i=>callbacks.delete(i),onFrame:()=>{}});
  const key=(type,code,extra={})=>{const e=new Event(type,{cancelable:true});Object.assign(e,{code,...extra});target.dispatchEvent(e);};
  const frame=at=>{now=at;const [i,fn]=callbacks.entries().next().value;callbacks.delete(i);fn();};
  return{s,loop,target,key,frame,callbacks,setTime:at=>now=at};
 }
 {
  const h=inputHarness();h.key('keydown','KeyF');check(h.loop.charging,'hold starts charge');
  for(let i=0;i<30;i++)h.key('keydown','KeyF',{repeat:true});
  h.frame(100600);check(h.s.getState().match.aimPower===55,'half charge uses elapsed time');
  check(h.s.getState().attacks===0,'no shot before release');h.key('keyup','KeyF');
  check(h.s.getState().attacks===1&&h.s.getState().match.projectile.power===55,'one shot at release power');
  h.key('keyup','KeyF');check(h.s.getState().attacks===1,'duplicate keyup never fires twice');
  check(chargePower(9999,1200)===100&&chargePower(-10,1200)===10,'charge clamps');
  h.loop.reset();h.key('keydown','KeyF');h.target.dispatchEvent(new Event('blur'));h.key('keyup','KeyF');
  check(h.s.getState().attacks===0&&!h.loop.charging,'blur cancels without firing');
  h.key('keydown','KeyF');h.loop.reset('legacy');h.key('keyup','KeyF');
  check(h.s.profile.id==='legacy'&&h.s.getState().attacks===0,'switch cancels charge and resets');
  h.key('keydown','KeyF');check(h.s.getState().attacks===1,'legacy still fires immediately');
  h.loop.reset('reference-v1');h.key('keydown','Space');h.key('keydown','KeyF');h.key('keyup','KeyF');
  check(h.s.getState().attacks===0&&!h.loop.charging,'airborne F cannot arm delayed shot');
  h.loop.reset();h.key('keydown','KeyF');h.setTime(101000);h.key('keyup','KeyF');check(h.s.getState().attacks===1,'release updates power even without RAF');
  h.loop.reset();h.frame(110000);check(h.s.getState().attacks===0&&h.s.getState().players[1].hp===100,'reset discards pending physical hit');
  for(let i=0;i<20;i++)h.loop.reset(i%2?'legacy':'reference-v1');
  check(h.callbacks.size===1,'A/B resets retain one RAF');h.key('keydown','KeyF');h.loop.dispose();h.key('keyup','KeyF');check(h.callbacks.size===0,'dispose cancels charge and RAF');
 }
 // Bounded accumulator: ground movement does not slow with display refresh rate.
 for(const hz of [30,60,120]){
  const h=inputHarness(),start=h.s.getState().players[0].spawn.x;h.key('keydown','KeyD');
  h.frame(100000);for(let i=1;i<=hz;i++)h.frame(100000+i*1000/hz);h.key('keyup','KeyD');
  const distance=h.s.getState().players[0].spawn.x-start;
  check(distance>=285&&distance<=315,'ground cadence stable at '+hz+'Hz');summary.movement.push({hz,distance:Math.round(distance)});h.loop.dispose();
 }
 // Heavier-gravity routes use intermediate islands instead of tall shortcuts.
 {
  const terrain=createBitmapTerrain(mask),physics=createAirbornePhysics(terrain,PRACTICE_PROFILES['reference-v1'].air),room={arena:{craters:[]}};
  for(const [name,sx,sy,direction,minX,maxX,targetY]of[
   ['main-left to upper-left',281,379,1,335,514,247],
   ['upper-right to nearby upper step',990,250,-1,860,953,145],
   ['middle-left to central',420,532,1,520,918,449],
   ['upper step to crown',534,145,1,580,860,89],
   ['right-main to upper-right',1161,380,-1,938,1144,247],
   ['upper-left to peak-step',472,247,1,488,580,145],
   ['central to lower-step',710,449,-1,580,677,350],
   ['lower-step to upper-step',660,350,-1,535,631,300],
   ['upper-step to upper-left',550,300,-1,335,514,247]
  ]){
   let found=null;
   search:for(const initial of [0,-direction,direction])for(let delay=0;delay<=700;delay+=100)for(let hold=100;hold<=2100;hold+=100){
    const x=sx*scale,y=terrain.findHuancavelicaV2SurfaceBelow(room,x,sy*scale-30)-8,p={alive:true,hp:100,spawn:{x,y,facing:direction}};
    physics.setV2AirInput(p,initial);physics.startV2Airborne(p,100000,{jump:true});
    for(let t=20;t<=4800&&p.airborne;t+=20){physics.setV2AirInput(p,t<delay?initial:t<delay+hold?direction:0);physics.advanceV2AirbornePlayer(room,p,100000+t);}
    const px=p.spawn.x/scale,py=(p.spawn.y+8)/scale;
    if(p.alive&&!p.airborne&&px>=minX-5&&px<=maxX+5&&Math.abs(py-targetY)<12){check(physics.v2GroundSurface(room,p.spawn)!=null,'route has stable support: '+name);found={name,initial,delay,hold,x:Math.round(px),y:Math.round(py)};break search;}
   }
   check(found,'preserve authored jump route: '+name);
   summary.routes.push(found);
  }
 }
 // Removing support starts a real fall for the player and the training target,
 // even if the target is already at 0 HP. No relocation to the next surface.
 for(const index of [0,1])for(const dead of index===1?[false,true]:[false]){
  const s=session('reference-v1'),room=s.getState(),p=room.players[index];
  if(dead){p.hp=0;p.alive=false;}
  const core=createGameplayCore(mask,{practice:true,tuning:PRACTICE_PROFILES['reference-v1']}),start={...p.spawn};
  room.arena.craters.push({id:'remove-support',x:start.x,y:start.y+8,radius:220});
  core.tick(room,100020);check(Boolean(p.airborne),'support loss starts fall '+index+'/'+dead);
  check(p.spawn.y===start.y,'support loss never teleports '+index+'/'+dead);
  core.tick(room,100040);check(p.spawn.y>start.y&&p.airborne.vy>0,'gravity accelerates unsupported body');
  for(let t=100060;t<=102000&&p.airborne;t+=20)core.tick(room,t);
  check(!p.airborne&&p.spawn.y>start.y,'body lands on remaining lower rock');
  check(core.physics.v2GroundSurface(room,p.spawn)!=null,'landing has real mask support');
  room.arena.craters.push({id:'erase-column',x:start.x,y:start.y,radius:9000});
  for(let t=102020;t<=107000;t+=20)core.tick(room,t);
  check(!p.alive&&!p.airborne,'body exits through void');
  if(index===1){check(p.outOfWorld,'dummy void exit marked');const y=p.spawn.y;core.tick(room,107100);check(p.spawn.y===y&&!p.airborne,'no repeat void fall loop');}
  s.dispose();
 }
 // Air Strike keeps both sky entry and all lower impacts within one wide shot.
 for(const bottom of [500,1800,3600]){
  const q={targetX:400,impactX:400,impactY:bottom,cameraAirStrikeShells:[{x:90,startX:90,startY:0,y:bottom},{x:715,startX:715,startY:0,y:bottom-100}]};
  const v=airStrikeCameraView({worldWidth:5000,worldHeight:3750},q),w=5000*v.units/5,h=3750*v.units/5;
  check(v.centerY-h/2===0,'air camera starts at sky');
  check(v.centerY+h/2>=bottom,'air camera includes bottom impact');
  check(v.centerX-w/2<=90&&v.centerX+w/2>=715,'air camera includes full strike spread');
 }
 return{assertions,...summary};
}
