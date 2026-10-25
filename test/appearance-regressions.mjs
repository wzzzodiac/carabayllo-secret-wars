import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {ANIMALS,CARTS,LEGACY_CARTS,normalizeAppearance} from '../appearance.js';
import {drawMiniAvatar,avatarLayout,projectAvatarBounds} from '../mini-avatar.js';
import {INTEGRATED_AVATARS} from '../assets/somber-v1/avatars/manifest.js';
import {VEHICLE_BODY} from '../simulation/vehicle-pose.js';
import {VEHICLE_HITBOX} from '../simulation/collision.js';
import {decodeRgbaPng} from './frontend-source-regressions.mjs';
export function runAppearanceRegressions(){
 assert.equal(readFileSync(new URL('../appearance.js',import.meta.url),'utf8'),readFileSync(new URL('../../backend/appearance.js',import.meta.url),'utf8'),'same cosmetic catalog in browser and authority');
 assert.deepEqual(normalizeAppearance({animal:'<script>',cart:'../../secret'}),{animal:'cuy',cart:'mototaxi'});
 assert.equal(CARTS.length,8);assert.equal(ANIMALS.length*CARTS.length,48);
 for(const [old,canonical]of Object.entries(LEGACY_CARTS))assert.equal(normalizeAppearance({animal:'cat',cart:old}).cart,canonical);
 assert.deepEqual(VEHICLE_HITBOX,{radius:51,centerYOffset:-10});
 assert.equal(VEHICLE_BODY.halfWidth,45);assert.equal(VEHICLE_BODY.top,-59);assert.equal(VEHICLE_BODY.feet,8);
 const images=Object.fromEntries(ANIMALS.map(a=>[a.id,{}])),unique=new Set();
 for(const animal of ANIMALS){
  const atlas=INTEGRATED_AVATARS.atlases[animal.id],png=decodeRgbaPng(readFileSync(new URL('../assets/somber-v1/avatars/'+atlas.file,import.meta.url)));
  assert.equal(png.width,2048);assert.equal(png.height,1024);
  for(const cart of CARTS){
   const frame=atlas.frames[cart.id],[x,y,w,h]=frame.source,region=Buffer.alloc(w*h*4);
   assert.ok(x>=0&&y>=0&&x+w<=png.width&&y+h<=png.height);
   let visible=0,bottom=0;
   for(let row=0;row<h;row++){
    png.pixels.copy(region,row*w*4,((y+row)*png.width+x)*4,((y+row)*png.width+x+w)*4);
    for(let col=0;col<w;col++)if(region[(row*w+col)*4+3]>64){visible++;if(row>=h-5)bottom++;}
   }
   assert.ok(visible>w*h*.25,'complete integrated sprite, not an empty frame');
   assert.ok(bottom>0,'wheel baseline reaches the lower authored bounds');
   const digest=createHash('sha256').update(region).digest('hex');assert.ok(!unique.has(digest),'every animal/vehicle combination has its own authored image');unique.add(digest);
   for(const facing of [-1,1]){
    const calls=[],transforms=[],translations=[],ctx=new Proxy({drawImage:(...args)=>calls.push(args),scale:(...args)=>transforms.push(args),translate:(...args)=>translations.push(args)},{get:(o,k)=>o[k]??(()=>{})});
    const geometry={x:300,y:400,pxX:.8,pxY:1.1,facing},look={animal:animal.id,cart:cart.id},layout=avatarLayout(look,geometry);
    assert.equal(drawMiniAvatar(ctx,look,geometry,images),true);
    assert.equal(calls.length,1,'one complete rider+vehicle draw; no runtime animal/cockpit collage');
    assert.equal(calls[0][0],images[animal.id]);assert.deepEqual(calls[0].slice(1,5),frame.source);
    const d=layout.sprite.dest;assert.equal(d[1]+d[3],VEHICLE_BODY.feet,'authored wheel baseline follows collider feet');
    assert.ok(layout.top<VEHICLE_BODY.top-25,'character remains visible above physical body');
    assert.ok(d[2]>VEHICLE_BODY.halfWidth*3);
    assert.ok(Math.abs(d[2]/d[3]-w/h)<1e-9,'integrated sprite preserves its own proportions');
    assert.deepEqual(transforms[0],[facing*1.1,1.1]);
    assert.equal(translations[0][1]+layout.feet*1.1,geometry.y+VEHICLE_BODY.feet*geometry.pxY);
    const wide={...geometry,pxX:1.6,pxY:1.2},bounds=projectAvatarBounds(layout,wide);
    assert.equal(bounds.bottom,wide.y+VEHICLE_BODY.feet*wide.pxY);
    assert.equal(bounds.bottom-bounds.top,(layout.feet-layout.top)*1.6);
   }
  }
 }
 assert.equal(unique.size,48);
 assert.doesNotMatch(readFileSync(new URL('../practice.html',import.meta.url),'utf8'),/<button\b/i);
 console.log('Integrated fleet: 48 unique complete sprites / both facings / exact feet / unchanged hitbox / no runtime rider collage: PASS');
}
