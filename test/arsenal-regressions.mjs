import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{createHash}from'node:crypto';import vm from'node:vm';
import{ARSENAL_ART}from'../assets/arsenal-v1/manifest.js';
import{drawWeaponSprite,projectileVisualPose,drawWeaponImpact,drawShieldVisual,drawHealVisual}from'../weapon-art.js';
import{decodeRgbaPng}from'./frontend-source-regressions.mjs';
export function runArsenalRegressions(){
 const sprites=decodeRgbaPng(readFileSync(new URL('../assets/arsenal-v1/objects.png',import.meta.url))),fx=decodeRgbaPng(readFileSync(new URL('../assets/arsenal-v1/impact.png',import.meta.url))),unique=new Set();
 assert.equal(sprites.width,ARSENAL_ART.width);assert.equal(sprites.height,ARSENAL_ART.height);
 assert.deepEqual(Object.keys(ARSENAL_ART.frames),['basic','heavy','triple','cluster','child','airstrike','airbomb','nuke','shield','heal']);
 for(const frame of Object.values(ARSENAL_ART.frames)){
  const [x,y,w,h]=frame.source,region=Buffer.alloc(w*h*4);assert.ok(x>=0&&y>=0&&x+w<=sprites.width&&y+h<=sprites.height);
  let opaque=0;for(let row=0;row<h;row++){sprites.pixels.copy(region,row*w*4,((y+row)*sprites.width+x)*4,((y+row)*sprites.width+x+w)*4);for(let col=0;col<w;col++)if(region[(row*w+col)*4+3]>=64)opaque++;}
  assert.ok(opaque>w*h*.2,'nonempty authored object');unique.add(createHash('sha256').update(region).digest('hex'));
 }
 assert.equal(unique.size,10);assert.equal(sprites.pixels[3],0);assert.equal(fx.pixels[3],0);
 for(const [x,y,w,h]of ARSENAL_ART.impact.frames){let visible=0;for(let py=y;py<y+h;py++)for(let px=x;px<x+w;px++)if(fx.pixels[(py*fx.width+px)*4+3]>16)visible++;assert.ok(visible>w*h*.03);}
 const draws=[],translations=[],rotations=[],texts=[],ctx=new Proxy({drawImage:(...v)=>draws.push(v),translate:(...v)=>translations.push(v),rotate:v=>rotations.push(v),fillText:(...v)=>texts.push(v)},{get:(o,k)=>o[k]??(()=>{})}),images={objects:{},impact:{}};
 for(const type of Object.keys(ARSENAL_ART.frames)){const n=draws.length;assert.equal(drawWeaponSprite(ctx,type,120,240,{size:50,angle:.7},images),true);assert.equal(draws.length,n+1);assert.deepEqual(translations.at(-1),[120,240]);assert.equal(rotations.at(-1),.7);}
 const count=draws.length;drawWeaponSprite(ctx,'triple',0,0,{icon:true},images);assert.equal(draws.length-count,3,'inventory icon shows3 darts, each flight still paints1');
 const flight={startedAt:1000,impactAt:3000,durationMs:2000,startX:100,startY:700,vx:120,vy:-200,gravity:400,windAccel:0},before=JSON.stringify(flight),view={x:0,y:0,width:1600,height:900};
 const pose=projectileVisualPose(flight,1500,view,1600,900);assert.deepEqual(pose,{x:160,y:650,angle:0});assert.equal(JSON.stringify(flight),before);
 assert.ok(projectileVisualPose(flight,2000,view,1600,900).angle>0,'shell turns nose down on descent');
 assert.equal(projectileVisualPose({...flight,vx:-120,vy:0,gravity:0},1500,view,1600,900).angle,Math.PI);
 assert.equal(projectileVisualPose({...flight,vx:0,vy:100,gravity:0},1500,view,1600,900).angle,Math.PI/2,'air bombs point down');
 assert.equal(projectileVisualPose({...flight,vx:120,vy:120,gravity:0},1500,{...view,width:800},1600,900).angle,Math.atan2(120,240),'world-space flight tangent is projected to screen space');
 assert.equal(drawWeaponImpact(ctx,'basic',200,300,-1,{},images),false);assert.equal(drawWeaponImpact(ctx,'basic',200,300,900,{},images),false);
 assert.equal(drawWeaponImpact(ctx,'heavy',200,300,450,{},images),true);assert.deepEqual(translations.at(-1),[200,300]);
 const player={id:'p',alive:true,shield:null,lastUtility:{type:'heal',amount:8,at:1000}},room={match:{projectile:{resolveAt:2000,shieldedPlayerIds:['p']}}},bounds={left:100,right:200,top:100,bottom:200},state=JSON.stringify({player,room});
 assert.equal(drawShieldVisual(ctx,player,room,bounds,1500),true,'shield remains visible for the complete covered volley');assert.equal(drawShieldVisual(ctx,player,room,bounds,2001),false);
 assert.equal(drawHealVisual(ctx,player,bounds,1200),true);assert.equal(texts.at(-1)[0],'+8','healing text uses actual restored HP');assert.equal(drawHealVisual(ctx,player,bounds,2300),false);
 assert.equal(JSON.stringify({player,room}),state,'art never changes combat state');
 const source=readFileSync(new URL('../renderer7a-visual.js',import.meta.url),'utf8'),fn=source.match(/function roomForBase\([\s\S]*?(?=\s+function loop)/)[0],convert=vm.runInNewContext('('+fn+')');
 const input={players:[],match:{projectile:{weaponType:'airstrike',airStrikeShells:[{x:10,y:20}]}}},snapshot=JSON.stringify(input),base=convert(input);
 assert.equal(base.arsenalPresentation,true);assert.equal(base.match.projectile.airStrikeShells.length,0);assert.equal(base.match.projectile.cameraAirStrikeShells.length,1);assert.equal(JSON.stringify(input),snapshot);
 assert.match(readFileSync(new URL('../renderer.js',import.meta.url),'utf8'),/if\(room.arsenalPresentation\)return;/,'composed renderer suppresses old orb pass');
 console.log('Arsenal:10 unique sprites /4 impact frames / projected trajectory tangents / complete shield volley / real heal amount / immutable state / no duplicate orb pass: PASS');
}
