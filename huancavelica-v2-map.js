export const HUANCAVELICA_V2_ID='huancavelica-v2';
export const HUANCAVELICA_V2_REVISION='huancavelica-v2-bitmap-1';
export const HUANCAVELICA_V2_COLLISION_MODEL='bitmap-terrain-mask-v2';
export const HUANCAVELICA_V2_IMAGE_WIDTH=1448;
export const HUANCAVELICA_V2_IMAGE_HEIGHT=1086;
export const HUANCAVELICA_V2_WORLD_WIDTH=5000;
export const HUANCAVELICA_V2_SCALE=HUANCAVELICA_V2_WORLD_WIDTH/HUANCAVELICA_V2_IMAGE_WIDTH;
export const HUANCAVELICA_V2_WORLD_HEIGHT=HUANCAVELICA_V2_IMAGE_HEIGHT*HUANCAVELICA_V2_SCALE;

const ASSET_URLS=Object.freeze({
  background:new URL('./assets/huancavelica-v2/background.png',import.meta.url).href,
  terrain:new URL('./assets/huancavelica-v2/terrain.png',import.meta.url).href,
  mask:new URL('./assets/huancavelica-v2/mask.png',import.meta.url).href,
  decor:new URL('./assets/huancavelica-v2/decor.png',import.meta.url).href
});

let cleanCollisionMask=null;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export const isHuancavelicaV2Room=room=>room?.terrainPreset===HUANCAVELICA_V2_ID||room?.arena?.phase11Theme===HUANCAVELICA_V2_ID;
export const huancavelicaV2RevisionCompatible=room=>!isHuancavelicaV2Room(room)||(room?.arena?.terrainRevision===HUANCAVELICA_V2_REVISION&&room?.arena?.collisionModel===HUANCAVELICA_V2_COLLISION_MODEL);
export function huancavelicaV2ImageToWorld(x,y){return{x:Number(x)*HUANCAVELICA_V2_SCALE,y:Number(y)*HUANCAVELICA_V2_SCALE};}
export function huancavelicaV2WorldToImage(x,y){return{x:Number(x)/HUANCAVELICA_V2_SCALE,y:Number(y)/HUANCAVELICA_V2_SCALE};}

// The authored image stays 4:3 in world space. Only the final screen projection
// fills the standard 16:9 canvas, and every world-space overlay uses its inverse.
export function huancavelicaV2Projection(view,canvasWidth,canvasHeight){
  const current=view??{x:0,y:0,width:HUANCAVELICA_V2_WORLD_WIDTH,height:HUANCAVELICA_V2_WORLD_HEIGHT};
  return{
    source:{x:current.x/HUANCAVELICA_V2_SCALE,y:current.y/HUANCAVELICA_V2_SCALE,width:current.width/HUANCAVELICA_V2_SCALE,height:current.height/HUANCAVELICA_V2_SCALE},
    destination:{x:0,y:0,width:canvasWidth,height:canvasHeight},
    scaleX:canvasWidth/current.width,
    scaleY:canvasHeight/current.height,
    originX:current.x,
    originY:current.y
  };
}
export function huancavelicaV2WorldToScreen(x,y,view,canvasWidth,canvasHeight){const p=huancavelicaV2Projection(view,canvasWidth,canvasHeight);return{x:(x-p.originX)*p.scaleX,y:(y-p.originY)*p.scaleY};}
export function huancavelicaV2ScreenToWorld(x,y,view,canvasWidth,canvasHeight){const p=huancavelicaV2Projection(view,canvasWidth,canvasHeight);return{x:p.originX+x/p.scaleX,y:p.originY+y/p.scaleY};}

function craterContains(crater,x,y){const cx=Number(crater?.x),cy=Number(crater?.y),radius=Math.max(0,Number(crater?.radius));return[cx,cy,radius].every(Number.isFinite)&&radius>0&&(x-cx)**2+(y-cy)**2<=radius**2;}
export function huancavelicaV2IsSolid(room,x,y){if(!cleanCollisionMask)return false;const image=huancavelicaV2WorldToImage(x,y),px=Math.floor(image.x),py=Math.floor(image.y);if(px<0||px>=HUANCAVELICA_V2_IMAGE_WIDTH||py<0||py>=HUANCAVELICA_V2_IMAGE_HEIGHT)return false;if(!cleanCollisionMask[py*HUANCAVELICA_V2_IMAGE_WIDTH+px])return false;return!(room?.arena?.craters??[]).some(crater=>craterContains(crater,Number(x),Number(y)));}

function playableBoundary(room,px,py){
  const world=huancavelicaV2ImageToWorld(px+.5,py),above=huancavelicaV2ImageToWorld(px+.5,py-1);if(!huancavelicaV2IsSolid(room,world.x,world.y)||huancavelicaV2IsSolid(room,above.x,above.y))return false;
  const boundaryNear=(x,target)=>{for(let delta=0;delta<=12;delta+=1)for(const y of delta?[target-delta,target+delta]:[target]){const a=huancavelicaV2ImageToWorld(x+.5,y),b=huancavelicaV2ImageToWorld(x+.5,y-1);if(huancavelicaV2IsSolid(room,a.x,a.y)&&!huancavelicaV2IsSolid(room,b.x,b.y))return y;}return null;};
  const left=[-6,-3].some(dx=>{const y=boundaryNear(px+dx,py);return y!=null&&Math.abs(y-py)<=12;}),right=[3,6].some(dx=>{const y=boundaryNear(px+dx,py);return y!=null&&Math.abs(y-py)<=12;});return left&&right;
}

export function huancavelicaV2SurfaceBelow(room,x,startY=0,maxDistance=HUANCAVELICA_V2_WORLD_HEIGHT){
  if(!cleanCollisionMask)return null;const image=huancavelicaV2WorldToImage(x,startY),px=Math.floor(image.x);if(px<0||px>=HUANCAVELICA_V2_IMAGE_WIDTH)return null;const start=clamp(Math.floor(image.y),0,HUANCAVELICA_V2_IMAGE_HEIGHT-1),end=clamp(Math.ceil((Number(startY)+Number(maxDistance))/HUANCAVELICA_V2_SCALE),0,HUANCAVELICA_V2_IMAGE_HEIGHT-1);for(let py=start;py<=end;py+=1)if(playableBoundary(room,px,py))return huancavelicaV2ImageToWorld(px+.5,py).y;return null;
}
export function huancavelicaV2TerrainY(room,x){return huancavelicaV2SurfaceBelow(room,x,0,HUANCAVELICA_V2_WORLD_HEIGHT)??HUANCAVELICA_V2_WORLD_HEIGHT;}

export function huancavelicaV2FirstSolidOnSegment(room,from,to){const a=huancavelicaV2WorldToImage(from.x,from.y),b=huancavelicaV2WorldToImage(to.x,to.y),steps=Math.max(1,Math.ceil(Math.max(Math.abs(b.x-a.x),Math.abs(b.y-a.y))*1.25));for(let index=0;index<=steps;index+=1){const t=index/steps,x=from.x+(to.x-from.x)*t,y=from.y+(to.y-from.y)*t;if(huancavelicaV2IsSolid(room,x,y))return{x,y,t};}return null;}

function imageFor(url,onLoad){const image=new Image();image.decoding='async';image.addEventListener('load',()=>onLoad(image),{once:true});image.src=url;return image;}
export function createHuancavelicaV2Painter(ctx,canvas){
  let backgroundImage=null,terrainImage=null,maskImage=null,decorImage=null,terrainCanvas=null,decorCanvas=null,damageSignature=null;
  const createLayer=image=>{const layer=document.createElement('canvas');layer.width=HUANCAVELICA_V2_IMAGE_WIDTH;layer.height=HUANCAVELICA_V2_IMAGE_HEIGHT;layer.getContext('2d').drawImage(image,0,0);return layer;};
  const initializeCollision=image=>{const source=createLayer(image),pixels=source.getContext('2d',{willReadFrequently:true}).getImageData(0,0,HUANCAVELICA_V2_IMAGE_WIDTH,HUANCAVELICA_V2_IMAGE_HEIGHT).data;cleanCollisionMask=new Uint8Array(HUANCAVELICA_V2_IMAGE_WIDTH*HUANCAVELICA_V2_IMAGE_HEIGHT);for(let index=0,pixel=0;index<cleanCollisionMask.length;index+=1,pixel+=4)cleanCollisionMask[index]=pixels[pixel+3]>=128?1:0;};
  const reset=()=>{if(!terrainImage||!decorImage)return;terrainCanvas=createLayer(terrainImage);decorCanvas=createLayer(decorImage);damageSignature=null;};
  backgroundImage=imageFor(ASSET_URLS.background,image=>{backgroundImage=image;});
  terrainImage=imageFor(ASSET_URLS.terrain,image=>{terrainImage=image;reset();});
  maskImage=imageFor(ASSET_URLS.mask,image=>{maskImage=image;initializeCollision(image);});
  decorImage=imageFor(ASSET_URLS.decor,image=>{decorImage=image;reset();});

  function clearCrater(layer,crater){const center=huancavelicaV2WorldToImage(crater.x,crater.y),radius=Number(crater?.radius)/HUANCAVELICA_V2_SCALE;if(![center.x,center.y,radius].every(Number.isFinite)||radius<=0)return;const layerCtx=layer.getContext('2d');layerCtx.save();layerCtx.globalCompositeOperation='destination-out';layerCtx.beginPath();layerCtx.arc(center.x,center.y,radius,0,Math.PI*2);layerCtx.fill();layerCtx.restore();}
  function syncDamage(room){if(!terrainCanvas||!decorCanvas)return;const craters=room?.arena?.craters??[],signature=craters.map(c=>[c.id??'',Number(c.x),Number(c.y),Number(c.radius)].join(':')).join('|');if(signature===damageSignature)return;terrainCanvas=createLayer(terrainImage);decorCanvas=createLayer(decorImage);for(const crater of craters){clearCrater(terrainCanvas,crater);clearCrater(decorCanvas,crater);}damageSignature=signature;}
  function drawLayer(layer,view){if(!layer)return;const {source,destination}=huancavelicaV2Projection(view,canvas.width,canvas.height);ctx.drawImage(layer,source.x,source.y,source.width,source.height,destination.x,destination.y,destination.width,destination.height);}
  function drawBackdrop(view){ctx.fillStyle='#061426';ctx.fillRect(0,0,canvas.width,canvas.height);if(backgroundImage?.complete&&backgroundImage.naturalWidth===HUANCAVELICA_V2_IMAGE_WIDTH&&backgroundImage.naturalHeight===HUANCAVELICA_V2_IMAGE_HEIGHT)drawLayer(backgroundImage,view);}
  function drawTerrain(room,view){syncDamage(room);drawLayer(terrainCanvas,view);drawLayer(decorCanvas,view);}
  function getAssetState(){return Object.freeze({ready:Boolean(backgroundImage?.complete&&terrainCanvas&&maskImage?.complete&&decorCanvas&&cleanCollisionMask),width:HUANCAVELICA_V2_IMAGE_WIDTH,height:HUANCAVELICA_V2_IMAGE_HEIGHT,uniformScale:HUANCAVELICA_V2_SCALE,maskSource:'cleaned-binary-mask',damageSignature});}
  return Object.freeze({drawBackdrop,drawTerrain,getAssetState});
}

export const huancavelicaV2BitmapTestHooks=Object.freeze({ASSET_URLS,craterContains,playableBoundary});
