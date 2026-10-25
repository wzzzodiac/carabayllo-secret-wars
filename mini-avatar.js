import {ANIMALS,CARTS,normalizeAppearance} from './appearance.js?v=peru-canon3-20261024';
import {INTEGRATED_AVATARS} from './assets/somber-v1/avatars/manifest.js?v=somber-v1-20261025';
import {VEHICLE_BODY} from './simulation/vehicle-pose.js';

// Every frame is one authored animal AND vehicle. No runtime head/body assembly.
let assets=null,loading=null;
export function loadMiniAssets(){
 if(loading)return loading;
 if(typeof Image==='undefined')return Promise.resolve(null);
 loading=Promise.all(ANIMALS.map(({id})=>new Promise((resolve,reject)=>{
  const image=new Image();image.decoding='async';image.onload=()=>{
   if(image.naturalWidth!==INTEGRATED_AVATARS.width||image.naturalHeight!==INTEGRATED_AVATARS.height){reject(new Error('Invalid integrated atlas '+id));return;}
   resolve([id,image]);
  };
  image.onerror=()=>reject(new Error('Could not load integrated atlas '+id));
  image.src=new URL('./assets/somber-v1/avatars/'+INTEGRATED_AVATARS.atlases[id].file+'?v='+INTEGRATED_AVATARS.version,import.meta.url).href;
 }))).then(entries=>(assets=Object.fromEntries(entries)));
 return loading;
}
export function avatarLayout(value,{x=0,y=0,pxX=1,pxY=1,facing=1}={}){
 const look=normalizeAppearance(value),frame=INTEGRATED_AVATARS.atlases[look.animal].frames[look.cart];
 const source=frame.source,width=frame.width,height=source[3]/source[2]*width,feet=VEHICLE_BODY.feet;
 return {look,cartIndex:CARTS.findIndex(c=>c.id===look.cart),x,y,pxX,pxY,facing:facing<0?-1:1,
  top:feet-height,feet,left:-width/2,right:width/2,sprite:{source,dest:[-width/2,feet-height,width,height]},rims:frame.rims};
}
export function drawMiniAvatar(ctx,value,geometry,images=assets){
 const layout=avatarLayout(value,geometry),image=images?.[layout.look.animal];
 if(!image)return false;
 const {x,y,pxX,pxY,facing,sprite}=layout,scale=Math.max(pxX,pxY),originY=y+layout.feet*(pxY-scale);
 const motion=geometry?.motion;
 ctx.save();ctx.translate(x,originY);ctx.scale(facing*scale,scale);ctx.imageSmoothingEnabled=true;
 if(motion){ctx.translate(0,layout.feet);ctx.rotate((motion.pitch??0)*facing);ctx.scale(1,motion.squash??1);ctx.translate(0,-layout.feet);}
 ctx.drawImage(image,...sprite.source,...sprite.dest);
 // Only central wheel hubs move, sampled from this same integrated frame.
 // Small clips retain the authored tire outline and its contact with the ground.
 if(motion&&Math.abs(motion.wheel??0)>.001){
  const [sx,sy,sw,sh]=sprite.source,[dx,dy,dw,dh]=sprite.dest,factor=dw/sw;
  for(const [u,v,radius]of layout.rims){
   const cx=sx+u*sw,cy=sy+v*sh,r=radius*sw*.56,px=dx+u*dw,py=dy+v*dh;
   ctx.save();ctx.beginPath();ctx.ellipse(px,py,r*factor*.85,r*factor,0,0,Math.PI*2);ctx.clip();ctx.translate(px,py);ctx.rotate(motion.wheel);
   ctx.drawImage(image,cx-r,cy-r,r*2,r*2,-r*factor,-r*factor,r*2*factor,r*2*factor);ctx.restore();
  }
 }
 ctx.restore();return true;
}
export function projectAvatarBounds(layout,{x=0,y=0,pxX=1,pxY=1,facing=1}={}){
 const scale=Math.max(pxX,pxY),bottom=y+layout.feet*pxY;
 return {left:x+(facing<0?-layout.right:layout.left)*scale,right:x+(facing<0?-layout.left:layout.right)*scale,
  top:bottom+(layout.top-layout.feet)*scale,bottom};
}
const previewVersions=new WeakMap();
export function drawAppearancePreview(canvas,value){
 const version=(previewVersions.get(canvas)??0)+1;previewVersions.set(canvas,version);
 const draw=()=>{
  if(!canvas.isConnected||previewVersions.get(canvas)!==version)return;
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
  const layout=avatarLayout(value),scale=Math.min((canvas.width-20)/(layout.right-layout.left),(canvas.height-16)/(layout.feet-layout.top));
  drawMiniAvatar(ctx,value,{x:canvas.width/2,y:canvas.height-8-layout.feet*scale,pxX:scale,pxY:scale});
 };
 draw();return loadMiniAssets().then(draw).catch(error=>{canvas.setAttribute('aria-label','Preview unavailable');console.error(error.message);});
}
