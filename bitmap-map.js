import {createBitmapTerrain} from './simulation/terrain.js?v=bitmap-maps-1';
import {THEMED_BITMAP_MAPS,themedMapFor,isThemedBitmapRoom} from './simulation/themed-maps.js?v=bitmap-maps-1';
import {isHuancavelicaV2Room,huancavelicaV2IsSolid,huancavelicaV2FirstSolidOnSegment,huancavelicaV2TerrainY,huancavelicaV2RevisionCompatible} from './huancavelica-v2-map.js?v=somber-v1-20261025';
export {THEMED_BITMAP_MAPS,themedMapFor,isThemedBitmapRoom};
const resources=new Map();
const image=async url=>{const img=new Image();img.src=url;await img.decode();return img;};
export function loadThemedBitmap(id){
 if(!THEMED_BITMAP_MAPS[id])return Promise.reject(new Error('Unknown bitmap map'));
 if(resources.has(id))return resources.get(id).promise;
 const config=THEMED_BITMAP_MAPS[id],entry={config,ready:false,error:null};resources.set(id,entry);
 const url=file=>new URL(file==='mask.png'?'./assets/map-themes/'+config.folder+'/mask.png?v='+config.revision:'./assets/somber-v1/'+config.folder+'/'+(file==='terrain-bitmap.png'?'terrain.png':file)+'?v=somber-v1-20261025',import.meta.url).href;
 entry.promise=(async()=>{
  const [background,terrain,mask]=await Promise.all([image(url('background.png')),image(url('terrain-bitmap.png')),image(url('mask.png'))]);
  if(terrain.naturalWidth!==1672||terrain.naturalHeight!==1672||mask.naturalWidth!==1672||mask.naturalHeight!==1672)throw new Error('Invalid bitmap asset dimensions');
  const c=document.createElement('canvas');c.width=c.height=1672;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(mask,0,0);
  const pixels=ctx.getImageData(0,0,1672,1672).data,bits=new Uint8Array(Math.ceil(1672*1672/8));
  for(let i=0;i<1672*1672;i++)if(pixels[i*4+3]>=128)bits[i>>3]|=1<<(i&7);
  Object.assign(entry,{background,terrain,bits,collision:createBitmapTerrain(bits,config.geometry),ready:true});return entry;
 })().catch(error=>{entry.error=error;throw error;});
 return entry.promise;
}
export const isBitmapPhysicsRoom=room=>isHuancavelicaV2Room(room)||isThemedBitmapRoom(room);
export const bitmapRevisionCompatible=room=>isThemedBitmapRoom(room)?room.arena?.terrainRevision===themedMapFor(room).revision&&room.arena?.collisionModel==='bitmap-terrain-mask-v2':huancavelicaV2RevisionCompatible(room);
const collisionFor=room=>resources.get(themedMapFor(room)?.id)?.collision;
export const bitmapIsSolid=(room,x,y)=>isThemedBitmapRoom(room)?collisionFor(room)?.isHuancavelicaV2Solid(room,x,y)??false:huancavelicaV2IsSolid(room,x,y);
export const bitmapFirstSolid=(room,a,b)=>isThemedBitmapRoom(room)?collisionFor(room)?.firstHuancavelicaV2SolidOnSegment(room,a,b)??null:huancavelicaV2FirstSolidOnSegment(room,a,b);
export const bitmapTerrainY=(room,x)=>isThemedBitmapRoom(room)?collisionFor(room)?.findHuancavelicaV2SurfaceBelow(room,x,0,5000)??5000:huancavelicaV2TerrainY(room,x);

export function createThemedBitmapPainter(ctx,canvas){
 const layers=new Map();let destroyed=false;
 function get(room){
  const config=themedMapFor(room);if(!config)return null;
  if(!resources.has(config.id))loadThemedBitmap(config.id).catch(error=>{if(!destroyed)console.error('[Bitmap map]',error.stack??error.message);});
  return resources.get(config.id);
 }
 function backdrop(room,view){
  const e=get(room);ctx.fillStyle=room.terrainPreset==='rolling'?'#354352':'#333d50';ctx.fillRect(0,0,canvas.width,canvas.height);
  if(e?.ready){const img=e.background;ctx.drawImage(img,view.x/5000*img.width,view.y/5000*img.height,view.width/5000*img.width,view.height/5000*img.height,0,0,canvas.width,canvas.height);}
 }
 function terrain(room,view){
  const e=get(room);if(!e?.ready)return;
  const key=e.config.id,signature=JSON.stringify(room.arena.craters??[]);let cache=layers.get(key);
  if(!cache||cache.signature!==signature){
   const layer=cache?.layer??document.createElement('canvas');layer.width=layer.height=1672;const c=layer.getContext('2d');c.drawImage(e.terrain,0,0);
   const mask=document.createElement('canvas');mask.width=mask.height=1672;const mc=mask.getContext('2d'),pixels=mc.createImageData(1672,1672),bits=e.collision.huancavelicaV2MaskForRoom(room);
   for(let i=0;i<1672*1672;i++){pixels.data[i*4]=pixels.data[i*4+1]=pixels.data[i*4+2]=255;pixels.data[i*4+3]=bits[i>>3]&(1<<(i&7))?255:0;}
   mc.putImageData(pixels,0,0);c.globalCompositeOperation='destination-in';c.drawImage(mask,0,0);c.globalCompositeOperation='source-over';
   cache={layer,signature};layers.set(key,cache);
  }
  const scale=1672/5000;ctx.drawImage(cache.layer,view.x*scale,view.y*scale,view.width*scale,view.height*scale,0,0,canvas.width,canvas.height);
 }
 return Object.freeze({drawBackdrop:backdrop,drawTerrain:terrain,destroy(){destroyed=true;layers.clear();}});
}
