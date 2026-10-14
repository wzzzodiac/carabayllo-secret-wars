import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import zlib from 'node:zlib';
import vm from 'node:vm';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const bytes = path => fs.readFileSync(new URL(`../${path}`, import.meta.url));
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex').toUpperCase();
const pngDimensions = buffer => ({ width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) });

export function decodeRgbaPng(buffer) {
  assert.equal(buffer.toString('hex', 0, 8), '89504e470d0a1a0a');
  let offset = 8, width = 0, height = 0, colorType = 0, bitDepth = 0;
  const compressed = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset), type = buffer.toString('ascii', offset + 4, offset + 8), data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; }
    if (type === 'IDAT') compressed.push(data);
    offset += 12 + length;
    if (type === 'IEND') break;
  }
  assert.equal(bitDepth, 8);
  assert.equal(colorType, 6);
  const raw = zlib.inflateSync(Buffer.concat(compressed)), stride = width * 4, pixels = Buffer.alloc(stride * height);
  const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  for (let y = 0, source = 0; y < height; y += 1) {
    const filter = raw[source++], row = y * stride, previous = row - stride;
    for (let x = 0; x < stride; x += 1) {
      const encoded = raw[source++], left = x >= 4 ? pixels[row + x - 4] : 0, above = y ? pixels[previous + x] : 0, upperLeft = y && x >= 4 ? pixels[previous + x - 4] : 0;
      const prediction = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? above : filter === 3 ? Math.floor((left + above) / 2) : paeth(left, above, upperLeft);
      pixels[row + x] = (encoded + prediction) & 255;
    }
  }
  return { width, height, pixels };
}

const visual = read('renderer7a-visual.js');
const phase10 = read('renderer10-huancavelica.js');
const huancavelicaMap = read('huancavelica-map.js');
const huancavelicaV2Map = read('huancavelica-v2-map.js');
const renderer = read('renderer.js');
const hud = read('renderer6f.js');
const index = read('index.html');
const readme = read('README.md');

// Exercise the actual composed presentation with a canvas recorder: v2 flight
// coordinates must come from the server, not the legacy endpoint sine/ease.
for (const type of ['cluster','airstrike']) {
  const arcs=[],sfx=[],frames=[];
  const context=new Proxy({arc:(...args)=>arcs.push(args)}, {get:(o,k)=>o[k]??(()=>{})});
  const overlay={width:1600,height:900,style:{},setAttribute(){},getContext:()=>context};
  let time=1500;
  const sandbox={Math,Date:{now:()=>time},document:{createElement:()=>overlay},
    requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},cancelAnimationFrame(){},
    window:{dispatchEvent:event=>sfx.push(event.detail)},CustomEvent:class {constructor(_,data){this.detail=data.detail;}},
    createPhase6fRenderer:()=>({drawArena(){},getViewSnapshot:()=>({x:0,y:0,width:1600,height:900})})};
  const source=visual.replace(/^import[^\n]+\n/,'').replace('export function createRenderer','function createRenderer');
  const create=vm.runInNewContext(`${source}\ncreateRenderer`,sandbox);
  const rendererUnderTest=create({width:1600,height:900,parentElement:{appendChild(){}}},{});
  const flight={id:'attack:child',impactId:'attack:child',bitmapFlight:true,startX:100,startY:700,vx:120,vy:-200,
    gravity:400,windAccel:0,startedAt:1000,visualStartAt:1000,impactAt:2000,durationMs:1000,x:220,y:700};
  const projectile={id:'attack',weaponType:type,startedAt:0,impactAt:500,
    impactX:900,impactY:900,clusterImpacts:type==='cluster'?[flight]:[],airStrikeShells:type==='airstrike'?[flight]:[]};
  rendererUnderTest.drawArena({status:'started',arena:{},match:{projectile}});
  frames[0]();
  assert.ok(arcs.some(([x,y,r])=>x===160&&y===650&&r===(type==='cluster'?10:12)),`${type} orb follows transmitted trajectory at t=.5s`);
  time=2050;frames[0]();frames[0]();
  assert.equal(sfx.filter(e=>e.key==='attack:child').length,1,`${type} stable impact ID emits once`);
  assert.ok(arcs.some(([x,y])=>Math.abs(x-220)<.0001&&Math.abs(y-700)<.0001),`${type} impact pulse uses definitive contact`);
}

assert.doesNotMatch(visual, /ctx\.moveTo\(tail\.x,t\.y\)/, 'Air Strike trail must not reference an undefined t variable');
assert.match(visual, /ctx\.moveTo\(tail\.x,tail\.y\)/, 'Air Strike trail must use the tail y coordinate');

assert.doesNotMatch(hud, /remaining\s*<=\s*20000/, 'Spectator F1 visibility must not depend on remaining turn time');
assert.match(hud, /voteWindow=Boolean\(vote&&now>=eligibleAt\)/, 'Spectator F1 visibility must follow AFK inactivity eligibility');
assert.match(hud, /AFK SKIP AFTER 20s INACTIVITY/, 'Spectator HUD must describe the inactivity rule');

assert.match(index, /<title>Carabayllo Secret Wars<\/title>/, 'Public title must use the current game name');
assert.match(index, /CARABAYLLO SECRET WARS \/\/ HUANCAVELICA V2/, 'Footer must identify the authored Huancavelica v2 build');
assert.match(index, /renderer10-huancavelica\.js\?v=huancavelica-v2-bitmap-1/, 'Public build must load the strict Huancavelica v2 revision');
assert.match(phase10, /renderer7a-visual\.js\?v=v098-csw-runtime-clean-1/, 'Huancavelica renderer must continue wrapping the cleaned RC renderer instead of replacing stable presentation mechanics');
assert.doesNotMatch(phase10, /createElement\(['"]canvas['"]\)/, 'Huancavelica must not cover vehicles with an opaque post-gameplay canvas');
assert.match(renderer, /createHuancavelicaPainter/, 'The stable renderer must integrate Huancavelica into the world draw order');
assert.match(renderer, /drawBackground\(room,view\);[\s\S]{0,180}drawTerrain\(room,view\)/, 'Bitmap scenery and terrain must share the gameplay camera transform');
assert.match(huancavelicaMap, /assets\/huancavelica\/background\.png/, 'Huancavelica must load the supplied authored background');
assert.match(huancavelicaMap, /assets\/huancavelica\/terrain\.png/, 'Huancavelica must load the supplied authored terrain');
assert.match(huancavelicaMap, /assets\/huancavelica\/decor\.png/, 'Huancavelica must load the supplied authored decor');
assert.match(huancavelicaMap, /getImageData\(/, 'Client collision sampling must be derived once from terrain alpha');
assert.match(huancavelicaMap, /globalCompositeOperation = 'destination-out'/, 'Crater replay must remove actual terrain pixels');
assert.match(huancavelicaMap, /drawLayer\(terrainCanvas, view\);\s*drawLayer\(decorCanvas, view\)/, 'Terrain and decor must retain the approved layer order');
assert.doesNotMatch(huancavelicaMap, /drawIsland\(|rockFacet\(|paintRockMass\(|function boulder\(/, 'The production map must not procedurally redraw supplied terrain art');
assert.doesNotMatch(huancavelicaMap, /RUTAS PRINCIPALES|PLATAFORMA CENTRAL|ALPINE RIDGE \/\//, 'Reference annotations must never be painted into the game map');

assert.match(huancavelicaV2Map, /HUANCAVELICA_V2_REVISION='huancavelica-v2-bitmap-1'/, 'Frontend must publish the strict v2 terrain revision');
assert.match(huancavelicaV2Map, /HUANCAVELICA_V2_COLLISION_MODEL='bitmap-terrain-mask-v2'/, 'Frontend must publish the v2 collision model');
assert.match(huancavelicaV2Map, /destination:\{x:0,y:0,width:canvasWidth,height:canvasHeight\}/, 'V2 authored layers must fill the gameplay canvas');
assert.match(huancavelicaV2Map, /const \{source,destination\}=huancavelicaV2Projection\(view,canvas\.width,canvas\.height\)/, 'Background, terrain and decor must share one projection');
assert.match(renderer, /huancavelicaV2WorldToScreen\(x,y,v,canvas\.width,canvas\.height\)/, 'V2 entities and effects must use the shared projection');
assert.match(renderer, /huancavelicaV2ScreenToWorld\(x,y,v,canvas\.width,canvas\.height\)/, 'V2 aim and pointer input must invert the shared projection');
assert.match(renderer, /if\(room\.status==='lobby'\)\{setFullMap\(room\)/, 'Switching between 5000-high maps and 3750-high v2 must recenter the full-map camera');
assert.doesNotMatch(renderer, /v2Destination\(|Math\.min\(canvas\.width\/v\.width/, 'V2 must not retain an inset letterbox projection');
assert.match(huancavelicaV2Map, /globalCompositeOperation='destination-out'/, 'V2 crater replay must remove pixels from the authored terrain and decor layers');
assert.match(huancavelicaV2Map, /layerCtx\.arc\(center\.x,center\.y,radius/, 'Uniform world/image scaling must keep v2 crater cuts circular');
assert.doesNotMatch(huancavelicaV2Map, /drawIsland\(|rockFacet\(|paintRockMass\(|function boulder\(/, 'V2 must never procedurally approximate the supplied terrain art');
assert.match(renderer, /huancavelicaV2RevisionCompatible/, 'Renderer must stop on frontend/backend terrain revision mismatch');

const assets = {
  background: bytes('assets/huancavelica/background.png'),
  terrain: bytes('assets/huancavelica/terrain.png'),
  mask: bytes('assets/huancavelica/mask.png'),
  decor: bytes('assets/huancavelica/decor.png')
};
assert.deepEqual(Object.fromEntries(Object.entries(assets).map(([name, value]) => [name, sha256(value)])), {
  background: '0D72A5A9EF1DB09CA684DD1690A3A888A993B91105474AFD3552B7B5804F588E',
  terrain: 'F45060D6FA3F33F7EB1944F58B5ADF458C4CADA3DBE8994C05AA13B3C52167E8',
  mask: '40707D2BDFCC8456DDF5E6F5097B0CD441B6B7DC56ADECDBCFBEF98CCF480A2C',
  decor: 'E0FB9EFA91B0014F0FBC9C179D1BF079005C26F2BBFEBA0B5C2F85636636036D'
});
for (const image of Object.values(assets)) assert.deepEqual(Object.values(pngDimensions(image)), [1448, 1086]);
const decoded = { terrain: decodeRgbaPng(assets.terrain), mask: decodeRgbaPng(assets.mask) };
for (let pixel = 0; pixel < 1448 * 1086; pixel += 1) assert.equal(decoded.mask.pixels[pixel * 4 + 3] === 255, decoded.terrain.pixels[pixel * 4 + 3] >= 16, `terrain/mask mismatch at pixel ${pixel}`);

const v2Assets = {
  background: bytes('assets/huancavelica-v2/background.png'),
  terrain: bytes('assets/huancavelica-v2/terrain.png'),
  mask: bytes('assets/huancavelica-v2/mask.png'),
  decor: bytes('assets/huancavelica-v2/decor.png')
};
assert.deepEqual(Object.fromEntries(Object.entries(v2Assets).map(([name, value]) => [name, sha256(value)])), {
  background: '3E4ED2285EB387A8D738CA5F1E282B78F73CBC597EE3469C807995A38084CDCA',
  terrain: '7765A17148F961046ABFCA4B9203E45DE239FF07A518216EA6F6106C16A776F4',
  mask: 'D6916AB8A2953F87CC664B84C25488222E7AD0845D691E594A0E2C68C892B97B',
  decor: 'BC57D1AA3AAE91766D5883785470FBC50590721CC94AD906B60B2DD925D1699D'
});
for (const image of Object.values(v2Assets)) assert.deepEqual(Object.values(pngDimensions(image)), [1448, 1086]);
const v2Mask = decodeRgbaPng(v2Assets.mask);
let v2SolidPixels = 0;
for (let pixel = 0; pixel < 1448 * 1086; pixel += 1) {
  const alpha = v2Mask.pixels[pixel * 4 + 3];
  assert.ok(alpha === 0 || alpha === 255, `v2 mask alpha must be binary at pixel ${pixel}`);
  if (alpha === 255) v2SolidPixels += 1;
}
assert.equal(v2SolidPixels, 380492, 'Clean v2 mask must keep the audited authored island mass');

const bitmap = await import('../huancavelica-map.js');
const imagePoint = bitmap.huancavelicaWorldToImage(1875, 3125);
const worldPoint = bitmap.huancavelicaImageToWorld(imagePoint.x, imagePoint.y);
assert.ok(Math.abs(worldPoint.x - 1875) < 1e-9 && Math.abs(worldPoint.y - 3125) < 1e-9, 'World/image transforms must be exact inverses');
const bitmapV2 = await import('../huancavelica-v2-map.js');
const v2ImagePoint = bitmapV2.huancavelicaV2WorldToImage(1875, 2812.5);
const v2WorldPoint = bitmapV2.huancavelicaV2ImageToWorld(v2ImagePoint.x, v2ImagePoint.y);
assert.ok(Math.abs(v2WorldPoint.x - 1875) < 1e-9 && Math.abs(v2WorldPoint.y - 2812.5) < 1e-9, 'V2 world/image transforms must be exact uniform inverses');
assert.equal(bitmapV2.HUANCAVELICA_V2_WORLD_HEIGHT, 3750, 'A 4:3 authored image must map to a 4:3 world without stretching');
for (const [canvasWidth,canvasHeight] of [[1600,900],[1280,720],[960,720]]) {
  for (const view of [{x:0,y:0,width:5000,height:3750},{x:1250,y:800,width:1000,height:750}]) {
    const projection=bitmapV2.huancavelicaV2Projection(view,canvasWidth,canvasHeight);
    assert.deepEqual(projection.destination,{x:0,y:0,width:canvasWidth,height:canvasHeight},'Every v2 camera view must fill the canvas');
    for (const [x,y] of [[view.x,view.y],[view.x+view.width,view.y+view.height],[view.x+view.width*.37,view.y+view.height*.61]]) {
      const screen=bitmapV2.huancavelicaV2WorldToScreen(x,y,view,canvasWidth,canvasHeight);
      const back=bitmapV2.huancavelicaV2ScreenToWorld(screen.x,screen.y,view,canvasWidth,canvasHeight);
      assert.ok(Math.abs(back.x-x)<1e-9&&Math.abs(back.y-y)<1e-9,'V2 screen/world coordinates must round-trip');
    }
  }
}
const fullV2View={x:0,y:0,width:5000,height:3750};
const terrainPixel={x:720,y:449},terrainWorld=bitmapV2.huancavelicaV2ImageToWorld(terrainPixel.x,terrainPixel.y);
const terrainScreen=bitmapV2.huancavelicaV2WorldToScreen(terrainWorld.x,terrainWorld.y,fullV2View,1600,900);
assert.ok(Math.abs(terrainScreen.x-terrainPixel.x/1448*1600)<1e-9&&Math.abs(terrainScreen.y-terrainPixel.y/1086*900)<1e-9,'Known terrain pixels must map to the same screen point as the authored image');
const spawnScreen=bitmapV2.huancavelicaV2WorldToScreen(terrainWorld.x,terrainWorld.y-8,fullV2View,1600,900);
assert.equal(spawnScreen.x,terrainScreen.x,'Vehicle spawn must stay in the same terrain column');
assert.ok(spawnScreen.y<terrainScreen.y,'Vehicle spawn must remain above its supporting terrain');
const impactScreen=bitmapV2.huancavelicaV2WorldToScreen(terrainWorld.x,terrainWorld.y,fullV2View,1600,900);
assert.deepEqual(impactScreen,terrainScreen,'Projectile impact, crater center and terrain contact use one projection');
const craterRadius=120,projection=bitmapV2.huancavelicaV2Projection(fullV2View,1600,900);
const craterImageRadius=craterRadius/bitmapV2.HUANCAVELICA_V2_SCALE;
assert.ok(Math.abs(craterImageRadius*(1600/1448)-craterRadius*projection.scaleX)<1e-9,'Crater horizontal cutout edge must match the projected world collision radius');
assert.ok(Math.abs(craterImageRadius*(900/1086)-craterRadius*projection.scaleY)<1e-9,'Crater vertical cutout edge must match the projected world collision radius');

assert.match(readme, /wzzzodiac\/carabayllo-secret-wars/, 'README must reference the renamed frontend repository');
assert.match(readme, /wzzzodiac\.github\.io\/carabayllo-secret-wars\//, 'README must reference the renamed Pages URL');
assert.doesNotMatch(readme, /wzzzodiac\.github\.io\/orbital-artillery\//, 'README must not advertise the obsolete Pages URL');

console.log('frontend source regressions: PASS');

// G05: every query in a raster pixel must agree with the pixel-centre cut rule.
const savedImage=globalThis.Image,savedDocument=globalThis.document;
try {
  globalThis.Image=class {addEventListener(_,fn){this.fn=fn;}set src(_){this.complete=true;this.naturalWidth=1448;this.naturalHeight=1086;this.fn(this);}};
  globalThis.document={createElement:()=>({getContext:()=>({drawImage(){},getImageData:()=>({data:v2Mask.pixels})})})};
  bitmapV2.createHuancavelicaV2Painter({},{});
  for(const craters of [[{id:'one',x:2490,y:1600,radius:135}],[{id:'one',x:2490,y:1600,radius:135},{id:'two',x:2570,y:1650,radius:72}]]) {
    const room={arena:{craters}};
    for(let py=420;py<520;py++)for(let px=670;px<770;px++)for(const fraction of [.1,.5,.9]){
      const x=(px+fraction)*bitmapV2.HUANCAVELICA_V2_SCALE,y=(py+fraction)*bitmapV2.HUANCAVELICA_V2_SCALE;
      const cx=(px+.5)*bitmapV2.HUANCAVELICA_V2_SCALE,cy=(py+.5)*bitmapV2.HUANCAVELICA_V2_SCALE;
      const expected=v2Mask.pixels[(py*1448+px)*4+3]>=128&&!craters.some(c=>(cx-c.x)**2+(cy-c.y)**2<=c.radius**2);
      assert.equal(bitmapV2.huancavelicaV2IsSolid(room,x,y),expected,`G05 pixel ${px},${py} fraction ${fraction}`);
    }
  }
} finally {globalThis.Image=savedImage;globalThis.document=savedDocument;}

const collision=await import('../simulation/collision.js');
const {simulateHuancavelicaV2Preview}=await import('../simulation/preview.js');
const previewSource=read('renderer.js').split(/\r?\n/).find(l=>l.includes('function simulatePreview('));
const actualPreview=vm.runInNewContext(`(${previewSource.trim()})`,{isHuancavelicaV2Room:bitmapV2.isHuancavelicaV2Room,simulateHuancavelicaV2Preview,huancavelicaV2IsSolid:bitmapV2.huancavelicaV2IsSolid,huancavelicaV2FirstSolidOnSegment:bitmapV2.huancavelicaV2FirstSolidOnSegment});
const shooter={id:'b',alive:true,spawn:{x:500,y:1000,facing:1}};
const velocity=815/Math.sqrt(2),grazeT=.5,grazeDy=-velocity+480*grazeT,grazeLength=Math.hypot(velocity,grazeDy);
const target={id:'a',alive:true,spawn:{x:524+velocity*grazeT-grazeDy/grazeLength*40,y:976-velocity*grazeT+240*grazeT**2+velocity/grazeLength*40+10}};
const previewRoom={terrainPreset:'huancavelica-v2',arena:{worldWidth:5000,worldHeight:3750,craters:[]},players:[shooter,target],match:{wind:{signed:0}}};
const grazingPreview=actualPreview(previewRoom,shooter,45,55);
assert.equal(grazingPreview.impact.type,'player');assert.equal(grazingPreview.impact.targetPlayerId,'a');
assert.ok(Math.abs(Math.hypot(grazingPreview.impact.x-target.spawn.x,grazingPreview.impact.y-target.spawn.y+10)-collision.VEHICLE_HITBOX.radius)<.01);
assert.ok(grazingPreview.dots.every(p=>p.x<grazingPreview.impact.x),'preview stops at first contact');
console.log('G04 actual renderer preview and G05 60000 raster queries: PASS');

// G07: the base world, camera and only visible vehicle layer sample one pose.
const {vehiclePose,nextVehiclePresentation,VEHICLE_BODY}=await import('../simulation/vehicle-pose.js');
const moving={id:'b',name:'B',alive:true,hp:100,spawn:{x:100,y:200,facing:1},presentation:{fromX:0,fromY:100,toX:100,toY:200,startedAt:1000,endsAt:1100,receivedAt:1000}};
const poseContext={Date:{now:()=>1050},vehiclePose,Math,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),lerp:(a,b,t)=>a+(b-a)*t,smoothstep:t=>t*t*(3-2*t)};
const basePoseLine=read('renderer.js').split(/\r?\n/).find(l=>l.includes('function visualPlayerPosition('));
const enhancedPoseSource=read('renderer6f.js').match(/function visualPlayerPosition\([\s\S]*?(?=\s+function worldToScreen)/)[0];
const basePose=vm.runInNewContext(`(${basePoseLine.trim()})`,poseContext),enhancedPose=vm.runInNewContext(`(${enhancedPoseSource.trim()})`,poseContext);
assert.deepEqual(JSON.parse(JSON.stringify(basePose(moving))),JSON.parse(JSON.stringify(enhancedPose(moving))));
assert.equal(basePose(moving).x,50);assert.equal(basePose(moving).y,150);
assert.equal(nextVehiclePresentation(moving.presentation,moving.spawn,1060),moving.presentation,'identical snapshot does not restart interpolation');
const continued=nextVehiclePresentation(moving.presentation,{x:200,y:250},1060);
assert.equal(continued.fromX,60);assert.equal(continued.fromY,160);assert.equal(vehiclePose({spawn:{x:200,y:250},presentation:continued},2000).x,200,'never overshoot');
let baseBodies=0;
const worldSource=read('renderer.js').split(/\r?\n/).find(l=>l.includes('function drawWorld('));
const noop=()=>{},worldContext={ctx:{clearRect:noop},canvas:{width:1600,height:900},currentView:()=>({}),drawBackground:noop,isHuancavelicaV2Room:()=>true,huancavelicaV2RevisionCompatible:()=>true,drawTerrain:noop,drawPreviewSpawns:noop,drawPickups:noop,drawAimPreview:noop,drawVehicle:()=>baseBodies++,visualPlayerPosition:basePose,localPlayerId:'b',drawProjectile:noop,drawLobbyHud:noop,drawResultOverlay:noop};
vm.runInNewContext(`(${worldSource.trim()})`,worldContext)({status:'started',arena:{},match:{activePlayerId:'b'},players:[moving]});
assert.equal(baseBodies,0,'v2 base world must not render a second vehicle');
const translations=[],rectangles=[],recordingCtx=new Proxy({measureText:()=>({width:80}),translate:(...v)=>translations.push(v),roundRect:(...v)=>rectangles.push(v)},{get:(o,k)=>o[k]??noop,set:(o,k,v)=>(o[k]=v,true)});
const enhancedVehicles=read('renderer6f.js').match(/function drawEnhancedVehicles\([\s\S]*?(?=\s+function drawWeaponBadge)/)[0];
vm.runInNewContext(`(${enhancedVehicles.trim()})`,{...poseContext,visualPlayerPosition:enhancedPose,overlay:{width:1600,height:900},worldToScreen:(x,y)=>({x:x*.32,y:y*.24}),ctx:recordingCtx,localPlayerId:'b',isHuancavelicaV2Room:()=>true,VEHICLE_BODY,VEHICLE_SCALE:.65})({mode:'team',match:{activePlayerId:'b'},players:[moving]}, {width:5000,height:3750});
assert.equal(rectangles.filter(v=>Math.abs(v[2]-VEHICLE_BODY.visualWidth*.32)<1e-8&&Math.abs(v[3]-VEHICLE_BODY.visualHeight*.24)<1e-8).length,1,'one actual enhanced body');
assert.ok(Math.abs(translations[0][1]+VEHICLE_BODY.visualHeight*.24*.52-(150+VEHICLE_BODY.feet)*.24)<1e-8,'visible wheel bottom and collider feet share the same world anchor');
console.log('G07 single visible body, pose interpolation and feet anchor: PASS');

const sentInputs=[],inputHandlers={};
const inputContext={Math,Date,Promise,window:{addEventListener:(name,fn)=>inputHandlers[name]=fn},currentRoom:{terrainPreset:'huancavelica-v2',status:'started',players:[{id:'b',alive:true,airborne:{}}],match:{activePlayerId:'b'}},playerId:'b',activeSocket:{},isHuancavelicaV2Room:()=>true,request:async(name,payload)=>{sentInputs.push({name,...payload});return{ok:true};},ui:{setMessage:()=>{}},setInterval:()=>1,clearInterval:()=>{},sendMoveStep:()=>{throw Error('ground timer while airborne');},queueAim:()=>{},fireShot:()=>{},selectItem:()=>{},canVoteAfkSkip:()=>false,toggleAfkSkipVote:()=>{},mutate:(name,payload)=>sentInputs.push({name,...payload})};
const inputClient=read('client.js'),heldSource=inputClient.slice(inputClient.indexOf('const heldV2Keys='),inputClient.indexOf('const MOVE_INTERVAL_MS'));
const turnFn=inputClient.split(/\r?\n/).find(l=>l.startsWith('function isMyActionTurn('));
const stopFn=inputClient.split(/\r?\n/).find(l=>l.startsWith('function stopHeldMove('));
const keyFns=inputClient.split(/\r?\n/).filter(l=>l.startsWith("window.addEventListener('keydown'")||l.startsWith("window.addEventListener('keyup'")).join('\n');
vm.runInNewContext('let heldMoveDirection=0,moveTimer=null;const MOVE_INTERVAL_MS=70;'+heldSource+'\n'+turnFn+'\n'+stopFn+'\n'+keyFns,inputContext);
const keyEvent=(code,repeat=false)=>({code,repeat,preventDefault(){}});
inputHandlers.keydown(keyEvent('KeyD'));
for(let i=0;i<12;i++)inputHandlers.keydown(keyEvent('KeyD',true));
await new Promise(resolve=>setImmediate(resolve));
inputHandlers.keyup(keyEvent('KeyD'));
await new Promise(resolve=>setImmediate(resolve));
assert.deepEqual(sentInputs.map(i=>i.direction),[1,0],'held input changes only, no key-repeat flood');
inputHandlers.keydown(keyEvent('Space'));assert.equal(sentInputs.length,2,'airborne double jump not sent');
console.log('G06 actual held-key handlers and bounded sends: PASS');
